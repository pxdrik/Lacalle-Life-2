import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanRepository } from "../../data/plan-repository";
import { PlanRepositoryProvider } from "../../data/plan-repository-context";
import { PlanPublishPanel } from "./plan-publish-panel";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function mount(publish: PlanRepository["publish"]) {
  const plans: PlanRepository = {
    listPlans: () =>
      Promise.resolve([
        { id: "p", name: "Plano", hasDraft: false, versions: [{ version: 2, name: "Plano", changeNote: "", publishedAt: "2026-09-26T12:00:00Z", meals: [] }] },
      ]),
    createPlan: () => Promise.resolve("p"),
    publish,
  };
  render(
    <PlanRepositoryProvider repository={plans}>
      <PlanPublishPanel linkId="l" planId="p" patientHref="/pro/pacientes" />
    </PlanRepositoryProvider>,
  );
}

describe("publicar o plano", () => {
  it("leva a nota e volta para o paciente", async () => {
    const publish = vi.fn(() => Promise.resolve(3));
    mount(publish);
    await userEvent.type(await screen.findByLabelText("O que mudou (opcional)"), "  Jantar trocado  ");
    await userEvent.click(screen.getByRole("button", { name: "Publicar versão 3" }));
    expect(publish).toHaveBeenCalledWith("p", "Jantar trocado");
    expect(push).toHaveBeenCalledWith("/pro/pacientes");
  });

  it("sem mudança desde a última versão, diz isso em vez de um erro de conexão", async () => {
    mount(() => Promise.reject(new Error("no draft")));
    await userEvent.click(await screen.findByRole("button", { name: "Publicar versão 3" }));
    expect(await screen.findByText("Nada mudou desde a versão 2.")).toBeInTheDocument();
  });
});
