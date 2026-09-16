import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { notifyStoreChanged } from "@/core/storage/store-events";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { LocalDietRepository } from "../data/local-diet-repository";
import { DIETS_STORE } from "../data/diet-store";
import { createDiet } from "../services/create-diet";
import type { Diet } from "../types/diet";
import { useDietList } from "./use-diet-list";

/**
 * Achado real, 17/09/2026: uma dieta criada no Diário (outra tela, mesmo
 * dispositivo) não aparecia aqui sem recarregar a página — nenhum hook sabia
 * que outro lugar tinha escrito no mesmo store. Isto prova a correção: uma
 * escrita feita por fora do próprio hook, seguida do aviso que
 * `SyncingDietRepository`/o motor de sync já disparam de verdade, é o
 * bastante para a lista se atualizar sozinha.
 */

function Probe() {
  const { state } = useDietList();

  if (state.status !== "ready") return <span data-testid="count">loading</span>;

  return <span data-testid="count">{state.diets.length}</span>;
}

describe("useDietList", () => {
  it("mostra uma dieta escrita por fora, sem remontar, quando o store avisa", async () => {
    const store = new MemoryStore<Diet>(DIETS_STORE);
    const repository = new LocalDietRepository(store);

    render(
      <DietRepositoryProvider repository={Promise.resolve(repository)}>
        <Probe />
      </DietRepositoryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("0");
    });

    // Simula outra tela (ou um pull de sincronização em segundo plano)
    // escrevendo diretamente no repositório, sem passar pelo hook.
    await repository.save(createDiet("Dieta criada em outra tela"), null);
    notifyStoreChanged("diets");

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
  });

  it("não reage a um aviso de outro store", async () => {
    const store = new MemoryStore<Diet>(DIETS_STORE);
    const repository = new LocalDietRepository(store);

    render(
      <DietRepositoryProvider repository={Promise.resolve(repository)}>
        <Probe />
      </DietRepositoryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("0");
    });

    await repository.save(createDiet("Não deveria aparecer ainda"), null);
    notifyStoreChanged("routines");

    // Sem `waitFor`: o objetivo é provar que nada muda, não esperar até que
    // mude — um `waitFor` aqui só esconderia uma falsa passagem se o aviso
    // errado também disparasse a recarga.
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
