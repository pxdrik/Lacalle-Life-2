import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { ToastProvider } from "@/design-system/components/toast";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { DIETS_STORE } from "../data/diet-store";
import { LocalDietRepository } from "../data/local-diet-repository";
import { LocalPrescribedPlanRepository, PRESCRIBED_PLANS_STORE } from "../data/prescribed-plan-repository";
import { PrescribedPlanRepositoryProvider } from "../data/prescribed-plan-repository-context";
import { createMeal } from "../services/create-diet";
import type { Diet } from "../types/diet";
import type { PrescribedPlan } from "../types/prescribed-plan";
import { DietList } from "./diet-list";
import { PrescribedPlanScreen } from "./prescribed-plan-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * O plano recebido no app do paciente: a cópia vira uma dieta dele e o plano
 * não muda; abrir uma versão nova apaga o "Atualizado"; sem repositório de
 * planos (conta anônima), Dietas fica exatamente como antes do Life Pro.
 */
const PLAN: PrescribedPlan = {
  id: "p",
  name: "Recomposição",
  professionalName: "Marina Faria",
  version: 2,
  changeNote: "",
  publishedAt: "2026-09-26T12:00:00Z",
  meals: [createMeal(1, "Almoço")],
  previous: null,
  weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  linkEnded: false,
  seenVersion: 0,
  createdAt: 1,
  updatedAt: 1,
};

async function setup(seen: number) {
  const diets = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const plans = new LocalPrescribedPlanRepository(new MemoryStore<PrescribedPlan>(PRESCRIBED_PLANS_STORE));
  await plans.replaceAll([PLAN]);
  await plans.markSeen("p", seen);
  const wrap = (page: React.ReactNode, withPlans = true) => (
    <ToastProvider>
      <DietRepositoryProvider repository={Promise.resolve(diets)}>
        {withPlans ? <PrescribedPlanRepositoryProvider repository={Promise.resolve(plans)}>{page}</PrescribedPlanRepositoryProvider> : page}
      </DietRepositoryProvider>
    </ToastProvider>
  );
  return { diets, plans, wrap };
}

describe("plano recebido no app do paciente", () => {
  it("Fazer uma cópia cria uma dieta dele e não mexe no plano", async () => {
    const { diets, plans, wrap } = await setup(2);
    render(wrap(<DietList />));
    await userEvent.click(await screen.findByRole("button", { name: "Fazer uma cópia" }));

    expect(await screen.findByText("Cópia criada em Suas dietas. O plano continua igual.")).toBeInTheDocument();
    const [copy] = await diets.listAll();
    expect(copy).toMatchObject({ name: "Recomposição (cópia)", weekdays: [] });
    expect(copy!.meals[0]!.id, "a cópia divide ids com o plano").not.toBe(PLAN.meals[0]!.id);
    expect(await plans.getById("p")).toMatchObject({ name: "Recomposição", version: 2 });
  });

  it("versão nova mostra Atualizado até o paciente abrir o plano", async () => {
    const { plans, wrap } = await setup(1);
    const { unmount } = render(wrap(<DietList />));
    expect(await screen.findByText("Atualizado")).toBeInTheDocument();
    unmount();

    render(wrap(<PrescribedPlanScreen planId="p" />));
    await screen.findByRole("heading", { name: "Recomposição" });
    await waitFor(async () => {
      expect((await plans.getById("p"))!.seenVersion).toBe(2);
    });
  });

  it("a primeira versão que chega não é Atualizado", async () => {
    const { wrap } = await setup(0);
    render(wrap(<DietList />));
    await screen.findByText("Recomposição");
    expect(screen.queryByText("Atualizado")).not.toBeInTheDocument();
  });

  it("sem repositório de planos, Dietas fica como antes", async () => {
    const { wrap } = await setup(0);
    render(wrap(<DietList />, false));
    await screen.findByText("Nenhuma dieta ainda.");
    expect(screen.queryByText("Do seu treinador")).not.toBeInTheDocument();
    expect(screen.queryByText("Suas dietas")).not.toBeInTheDocument();
  });

  it("versão nova: o aviso abre o que mudou, com a nota e a comparação, e conta como visto", async () => {
    const { plans, wrap } = await setup(1);
    const [meal] = PLAN.meals;
    await plans.replaceAll([
      {
        ...PLAN,
        changeNote: "Almoço com outro nome",
        previous: { version: 1, meals: [meal!] },
        meals: [{ ...meal!, name: "Almoço leve" }],
      },
    ]);
    render(wrap(<DietList />));
    await userEvent.click(await screen.findByRole("button", { name: "Ver o que mudou" }));

    const sheet = await screen.findByRole("dialog", { name: "O que mudou na versão 2" });
    expect(within(sheet).getByText("Nota de Marina Faria: “Almoço com outro nome”")).toBeInTheDocument();
    expect(within(sheet).getByText("Almoço agora se chama Almoço leve")).toBeInTheDocument();
    await waitFor(async () => {
      expect((await plans.getById("p"))!.seenVersion).toBe(2);
    });
  });
});
