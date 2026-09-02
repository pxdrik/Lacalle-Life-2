import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { BODY_ENTRIES_STORE } from "../data/body-repository";
import { BodyRepositoryProvider } from "../data/body-repository-context";
import { LocalBodyRepository } from "../data/local-body-repository";
import { EMPTY_MEASUREMENTS } from "../services/body-log";
import type { BodyEntry } from "../types/body-entry";
import { BodyScreen } from "./body-screen";

function entry(overrides: Partial<BodyEntry> & { id: string }): BodyEntry {
  return {
    day: overrides.id,
    weightKg: 80,
    bodyFatPercent: null,
    measurements: EMPTY_MEASUREMENTS,
    notes: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

async function mount(entries: readonly BodyEntry[]) {
  const store = new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE);
  const repository = new LocalBodyRepository(store);
  await Promise.all(entries.map((e) => repository.save(e, null)));

  render(
    <BodyRepositoryProvider repository={Promise.resolve(repository)}>
      <BodyScreen />
    </BodyRepositoryProvider>,
  );
}

/**
 * Achado de auditoria de design (02/09/2026): com zero medições, a tela
 * mostrava "+ Registrar" (cabeçalho, pequeno) e "+ Registrar peso" (empty
 * state, grande) ao mesmo tempo — dois botões para a mesma ação, lado a
 * lado. A regra combinada com o Pedro: empty state carrega o CTA principal;
 * o botão do cabeçalho só reaparece depois que existe pelo menos um
 * registro para editar a partir dali.
 */
describe("BodyScreen — CTA de registrar peso", () => {
  it("shows only the empty state's CTA when there is nothing recorded yet", async () => {
    await mount([]);

    expect(await screen.findByText("Nenhuma medição ainda.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar peso" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar" }),
    ).not.toBeInTheDocument();
  });

  it("shows only the header's CTA once at least one entry exists", async () => {
    await mount([entry({ id: "2026-08-01" })]);

    expect(await screen.findByRole("button", { name: "Registrar" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar peso" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma medição ainda.")).not.toBeInTheDocument();
  });
});
