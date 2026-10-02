import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { dayKey } from "@/core/format/day";
import { MemoryStore } from "@/core/storage/memory-store";
import { ToastProvider } from "@/design-system/components/toast";
import type { Food } from "@/features/foods";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { DIETS_STORE } from "../data/diet-store";
import { FOOD_LOGS_STORE } from "../data/food-log-repository";
import { FoodLogRepositoryProvider } from "../data/food-log-repository-context";
import { LocalDietRepository } from "../data/local-diet-repository";
import { LocalFoodLogRepository } from "../data/local-food-log-repository";
import {
  LocalPrescribedPlanRepository,
  PRESCRIBED_PLANS_STORE,
  type PrescribedPlanRepository,
} from "../data/prescribed-plan-repository";
import { PrescribedPlanRepositoryProvider } from "../data/prescribed-plan-repository-context";
import { createDiet, createMeal, createMealItem } from "../services/create-diet";
import { weekdayOf, WEEKDAYS } from "../services/diet-schedule";
import type { Diet } from "../types/diet";
import type { FoodLog } from "../types/food-log";
import type { PrescribedPlan } from "../types/prescribed-plan";
import { DietList } from "./diet-list";
import { FoodLogScreen } from "./food-log-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/diario",
}));

/**
 * O plano da nutricionista nas telas do paciente (Life Pro, Etapas 5c e 5e):
 * no Diário, o plano é o padrão nos dias dele; num dia que também é de uma
 * dieta da pessoa, ela escolhe, e a escolha fica no dia. A "Opção de hoje"
 * troca os alimentos do dia e some depois de marcar como comida. Em Dietas,
 * os dias do plano são da nutricionista e aparecem só para leitura.
 */
const TODAY = dayKey(new Date());
const TODAY_WEEKDAY = weekdayOf(new Date());
const OTHER_DAY = WEEKDAYS.find((day) => day !== TODAY_WEEKDAY)!;
const item = (name: string) =>
  createMealItem({ foodId: name, name, grams: 100, per100g: { kcal: 100, proteinG: 10, carbsG: 10, fatG: 2 } });

const PLAN: PrescribedPlan = {
  id: "plano",
  name: "Recomposição",
  professionalName: "Marina Faria",
  version: 1,
  changeNote: "",
  publishedAt: "2026-08-01T12:00:00Z",
  meals: [
    {
      ...createMeal(1, "Almoço"),
      items: [item("Arroz")],
      alternatives: [{ id: "marmita", name: "Marmita", items: [item("Macarrão")] }],
    },
  ],
  previous: null,
  weekdays: [...WEEKDAYS],
  linkEnded: false,
  seenVersion: 1,
  createdAt: 1,
  updatedAt: 1,
};

async function mount(page: React.ReactNode, ownDiet?: Diet) {
  const logs = new LocalFoodLogRepository(new MemoryStore<FoodLog>(FOOD_LOGS_STORE));
  const diets = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  if (ownDiet !== undefined) await diets.save(ownDiet, null);
  const local = new LocalPrescribedPlanRepository(new MemoryStore<PrescribedPlan>(PRESCRIBED_PLANS_STORE));
  await local.replaceAll([PLAN]);
  const plans: PrescribedPlanRepository = {
    listAll: () => local.listAll(),
    getById: (id) => local.getById(id),
    markSeen: (id, version) => local.markSeen(id, version),
  };
  render(
    <ToastProvider>
      <FoodLogRepositoryProvider repository={Promise.resolve(logs)}>
        <DietRepositoryProvider repository={Promise.resolve(diets)}>
          <FoodRepositoryProvider repository={Promise.resolve(new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE)))}>
            <PrescribedPlanRepositoryProvider repository={Promise.resolve(plans)}>{page}</PrescribedPlanRepositoryProvider>
          </FoodRepositoryProvider>
        </DietRepositoryProvider>
      </FoodLogRepositoryProvider>
    </ToastProvider>,
  );
  return { logs, diets };
}

describe("o plano no Diário", () => {
  it("é o dia quando nenhuma dieta da pessoa é, e a opção de hoje troca os alimentos", async () => {
    const { logs } = await mount(<FoodLogScreen day={TODAY} />);
    expect(await screen.findByText(/Plano de hoje:/)).toHaveTextContent("Plano de hoje: Recomposição, de Marina Faria");

    await userEvent.click(screen.getByRole("button", { name: 'Começar de "Recomposição"' }));
    await userEvent.click(await screen.findByRole("button", { name: /Almoço, opção de hoje: Principal/ }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Marmita/ }));

    await waitFor(async () => {
      const [meal] = (await logs.getByDay(TODAY))!.meals;
      expect(meal!.items.map((food) => food.name)).toEqual(["Macarrão"]);
    });
    expect(await screen.findByRole("button", { name: /Almoço, opção de hoje: Marmita/ })).toBeInTheDocument();
  });

  it("a escolha some depois de marcar a refeição como comida", async () => {
    await mount(<FoodLogScreen day={TODAY} />);
    await userEvent.click(await screen.findByRole("button", { name: 'Começar de "Recomposição"' }));
    await screen.findByRole("button", { name: /opção de hoje/ });
    await userEvent.click(screen.getByRole("button", { name: /Marcar Almoço como comid/ }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /opção de hoje/ })).not.toBeInTheDocument();
    });
  });

  it("no dia do plano e de uma dieta da pessoa, o plano é o padrão, e a escolha dela fica no dia", async () => {
    const own = { ...createDiet("Minha dieta"), weekdays: [TODAY_WEEKDAY] };
    const { logs } = await mount(<FoodLogScreen day={TODAY} />, own);

    const choice = await screen.findByRole("group", { name: /Qual vale hoje\?/ });
    expect(within(choice).getByRole("button", { name: /Plano de Marina Faria/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: 'Começar de "Recomposição"' })).toBeInTheDocument();

    await userEvent.click(within(choice).getByRole("button", { name: /Minha dieta/ }));
    expect(await screen.findByRole("button", { name: 'Começar de "Minha dieta"' })).toBeInTheDocument();
    expect(within(choice).getByRole("button", { name: /Minha dieta/ })).toHaveAttribute("aria-pressed", "true");
    // Gravada antes de qualquer refeição: um dia vazio seria apagado, e a
    // escolha sumiria no próximo carregamento.
    await waitFor(async () => {
      expect((await logs.getByDay(TODAY))?.dietId).toBe(own.id);
    });
  });
});

describe("os dias do plano em Dietas", () => {
  it("são os da nutricionista, só para leitura, e não mexem nos dias das dietas da pessoa", async () => {
    const own = { ...createDiet("Minha dieta"), weekdays: [OTHER_DAY] };
    const { diets } = await mount(<DietList />, own);

    expect(await screen.findByText("Dias do plano:")).toBeInTheDocument();
    expect(screen.getByText("Dias do plano:").parentElement).toHaveTextContent("Todos os dias");
    expect(screen.queryByRole("button", { name: /Dias do plano/ })).not.toBeInTheDocument();
    expect((await diets.listAll())[0]!.weekdays).toEqual([OTHER_DAY]);
  });
});
