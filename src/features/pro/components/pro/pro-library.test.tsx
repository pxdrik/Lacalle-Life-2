import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository, patientLink } from "../../data/fake-care-repository.test-helper";
import type { PlanTemplate, TemplateRepository } from "../../data/template-repository";
import { TemplateRepositoryProvider } from "../../data/template-repository-context";
import { ProLibrary } from "./pro-library";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

/**
 * A Biblioteca na tela (Etapa 5d): os modelos com refeições e kcal, "Novo
 * modelo" abre o editor, "Usar em paciente" só oferece vínculo ativo e abre o
 * plano novo, e apagar tira da lista. O que o banco garante (cópia, dona) está
 * em `composition/template-repository.db.test.ts`.
 */
const TEMPLATES: PlanTemplate[] = [
  { id: "t1", name: "Déficit moderado", mealCount: 5, kcal: 1800.4, updatedAt: "2026-10-01T12:00:00Z" },
  { id: "t2", name: "Hipertrofia", mealCount: 1, kcal: 2800, updatedAt: "2026-09-20T12:00:00Z" },
];

function fakeTemplates(initial: readonly PlanTemplate[]): TemplateRepository & { readonly calls: string[] } {
  const calls: string[] = [];
  let templates = [...initial];
  return {
    calls,
    listTemplates: () => Promise.resolve(templates),
    createTemplate: (name) => {
      calls.push(`create:${name}`);
      return Promise.resolve("novo");
    },
    deleteTemplate: (id) => {
      calls.push(`delete:${id}`);
      templates = templates.filter((template) => template.id !== id);
      return Promise.resolve();
    },
    applyToPatient: (templateId, linkId) => {
      calls.push(`apply:${templateId}:${linkId}`);
      return Promise.resolve("plano-novo");
    },
  };
}

function mount(templates: readonly PlanTemplate[] = TEMPLATES) {
  push.mockClear();
  const repository = fakeTemplates(templates);
  const care = fakeCareRepository({
    links: [
      patientLink({ id: "l1", label: "Ana Luísa Prado" }),
      patientLink({ id: "l2", label: "Paulo Henrique Dias", status: "ended", endedAt: "2026-09-12T12:00:00Z" }),
    ],
  });
  render(
    <CareRepositoryProvider repository={care}>
      <TemplateRepositoryProvider repository={repository}>
        <ProLibrary />
      </TemplateRepositoryProvider>
    </CareRepositoryProvider>,
  );
  return repository;
}

describe("Biblioteca do Life Pro", () => {
  it("lista os modelos com refeições, kcal e data, cada um abrindo o editor", async () => {
    mount();
    const card = (await screen.findByRole("heading", { name: "Déficit moderado" })).closest("li")!;
    expect(card).toHaveTextContent("5 refeições · 1.800 kcal");
    expect(card).toHaveTextContent("Atualizado em 01/10");
    expect(within(card).getByRole("link")).toHaveAttribute("href", "/pro/biblioteca/t1");
    expect(screen.getByText("1 refeição · 2.800 kcal")).toBeInTheDocument();
  });

  it("sem modelos, o estado vazio também cria", async () => {
    const repository = mount([]);
    expect(await screen.findByText("Nenhum modelo ainda.")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Novo modelo" }).at(-1)!);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/pro/biblioteca/novo");
    });
    expect(repository.calls).toEqual(["create:Modelo novo"]);
  });

  it("usar em paciente oferece só vínculo ativo, cria o plano e abre o editor dele", async () => {
    const repository = mount();
    const card = (await screen.findByRole("heading", { name: "Hipertrofia" })).closest("li")!;
    await userEvent.click(within(card).getByRole("button", { name: "Usar em paciente" }));

    const dialog = await screen.findByRole("dialog", { name: "Usar Hipertrofia" });
    await userEvent.click(await within(dialog).findByRole("button", { name: /Ana Luísa Prado/ }));
    expect(within(dialog).queryByText("Paulo Henrique Dias"), "vínculo encerrado oferecido").toBeNull();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/pro/pacientes/l1/plano/plano-novo");
    });
    expect(repository.calls).toEqual(["apply:t2:l1"]);
  });

  it("apagar pede confirmação e tira da lista", async () => {
    const repository = mount();
    const card = (await screen.findByRole("heading", { name: "Déficit moderado" })).closest("li")!;
    await userEvent.click(within(card).getByRole("button", { name: "Apagar Déficit moderado" }));
    expect(repository.calls, "apagou sem confirmar").toEqual([]);
    await userEvent.click(within(card).getByRole("button", { name: /Apagar\?/ }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Déficit moderado" })).toBeNull();
    });
    expect(repository.calls).toEqual(["delete:t1"]);
  });
});
