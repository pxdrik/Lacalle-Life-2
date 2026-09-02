import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { LocalProfileRepository } from "../data/local-profile-repository";
import { PROFILE_STORE } from "../data/profile-repository";
import { ProfileRepositoryProvider } from "../data/profile-repository-context";
import { notifyProfileChanged } from "../data/profile-changed";
import { PROFILE_ID, type Profile } from "../types/profile";
import { useProfile } from "./use-profile";

function Probe() {
  const { state } = useProfile();

  if (state.status !== "ready") {
    return <span data-testid="weight">{state.status}</span>;
  }

  return <span data-testid="weight">{state.profile.nutrition.weightKg}</span>;
}

const profile = (weightKg: number): Profile => ({
  id: PROFILE_ID,
  nutrition: {
    sex: "male",
    ageYears: 30,
    heightCm: 180,
    weightKg,
    activityLevel: "moderate",
    goal: "maintain",
  },
  createdAt: 1,
  updatedAt: 1,
});

/**
 * Achado ao vivo contra produção (02/09/2026): `useProfile` só lia o
 * repositório uma vez, ao montar — uma sincronização puxando um perfil novo
 * por baixo não tinha como chegar à tela, então o número ficava desatualizado
 * mesmo depois de "Sincronizar dados" ter funcionado de verdade. Estes testes
 * provam o motivo de existir da assinatura em `profile-changed.ts`.
 */
describe("useProfile — releitura ao avisar que o perfil mudou por fora", () => {
  it("mostra o peso novo depois de notifyProfileChanged, sem precisar remontar", async () => {
    const repository = new LocalProfileRepository(
      new MemoryStore<Profile>(PROFILE_STORE),
    );
    await repository.save(profile(80), null);

    render(
      <ProfileRepositoryProvider repository={Promise.resolve(repository)}>
        <Probe />
      </ProfileRepositoryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("weight")).toHaveTextContent("80");
    });

    // Muda por fora do hook — o mesmo que o motor de sync faz depois de um
    // pull bem-sucedido, gravando direto no repositório.
    await repository.save({ ...profile(84), createdAt: 1, updatedAt: 2 }, 1);
    await notifyProfileChanged();

    await waitFor(() => {
      expect(screen.getByTestId("weight")).toHaveTextContent("84");
    });
  });

  it("nunca fica preso em \"loading\" depois de reler por um aviso — sempre chega a um valor pronto", async () => {
    const renders: string[] = [];
    function TrackedProbe() {
      const { state } = useProfile();
      const value =
        state.status === "ready" ? String(state.profile.nutrition.weightKg) : state.status;
      renders.push(value);
      return <span data-testid="weight">{value}</span>;
    }

    const repository = new LocalProfileRepository(
      new MemoryStore<Profile>(PROFILE_STORE),
    );
    await repository.save(profile(80), null);

    render(
      <ProfileRepositoryProvider repository={Promise.resolve(repository)}>
        <TrackedProbe />
      </ProfileRepositoryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("weight")).toHaveTextContent("80");
    });
    renders.length = 0;

    await repository.save({ ...profile(84), createdAt: 1, updatedAt: 2 }, 1);
    await notifyProfileChanged();

    await waitFor(() => {
      expect(screen.getByTestId("weight")).toHaveTextContent("84");
    });

    // Nenhum render entre o aviso e o valor novo passou por "loading" — a
    // releitura por `notifyProfileChanged` troca o número direto, ao
    // contrário de `reload()` (usado só depois de um conflito), que
    // deliberadamente passa por "loading".
    expect(renders).not.toContain("loading");
  });

  it("para de assinar depois de desmontar — um aviso tardio não quebra nada", async () => {
    const repository = new LocalProfileRepository(
      new MemoryStore<Profile>(PROFILE_STORE),
    );
    await repository.save(profile(80), null);

    const { unmount } = render(
      <ProfileRepositoryProvider repository={Promise.resolve(repository)}>
        <Probe />
      </ProfileRepositoryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("weight")).toHaveTextContent("80");
    });

    unmount();

    await expect(notifyProfileChanged()).resolves.toBeUndefined();
  });
});
