import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { ToastProvider } from "@/design-system/components/toast";
import type { Food } from "@/features/foods";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";
import { FOODS_STORE } from "@/features/foods/data/food-store";

import { createMeal, createMealItem } from "../services/create-diet";
import type { FoodLog } from "../types/food-log";
import type { Meal } from "../types/diet";
import { useConsolidateMeal } from "./use-consolidate-meal";

function mealWithTwoFoods(mealId: string): Meal {
  return {
    ...createMeal(1),
    id: mealId,
    items: [
      createMealItem({
        foodId: "peito-de-frango",
        name: "Peito de frango grelhado",
        grams: 150,
        per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      }),
      createMealItem({
        foodId: "arroz",
        name: "Arroz branco",
        grams: 100,
        per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
      }),
    ],
  };
}

function logWith(meal: Meal): FoodLog {
  return {
    id: "2026-09-23",
    day: "2026-09-23",
    dietId: null,
    meals: [meal],
    createdAt: 1,
    updatedAt: 1,
  };
}

function Probe({
  meal,
  apply,
  name = "Marmita de frango",
}: {
  readonly meal: Meal;
  readonly apply: (change: (current: FoodLog) => FoodLog) => void;
  readonly name?: string | undefined;
}) {
  const consolidate = useConsolidateMeal(apply);

  return (
    <button
      type="button"
      onClick={() => {
        consolidate(meal, name, "protein");
      }}
    >
      transformar
    </button>
  );
}

function mount(
  meal: Meal,
  apply: (change: (current: FoodLog) => FoodLog) => void,
  name?: string,
) {
  const repository = new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));

  render(
    <ToastProvider>
      <FoodRepositoryProvider repository={Promise.resolve(repository)}>
        <Probe meal={meal} apply={apply} name={name} />
      </FoodRepositoryProvider>
    </ToastProvider>,
  );

  return repository;
}

/**
 * Pedro, 23/09/2026: "queria que isso virasse um alimento, e eu poder usar
 * em outros dias no diario e ate mesmo adicionar na dieta. Ent ele deve
 * criar um novo alimento mesmo" — e "faltou um botão para desfazer".
 */
describe("useConsolidateMeal", () => {
  it("salva um Food de verdade no catálogo, com o total combinado real", async () => {
    const meal = mealWithTwoFoods("m1");
    const log = logWith(meal);
    const apply = vi.fn((change: (current: FoodLog) => FoodLog) => change(log));
    const repository = mount(meal, apply);

    await userEvent.click(screen.getByRole("button", { name: "transformar" }));

    await waitFor(async () => {
      expect(await repository.listAll()).toHaveLength(1);
    });
    const [food] = await repository.listAll();
    expect(food).toMatchObject({
      name: "Marmita de frango",
      category: "protein",
      isCustom: true,
    });
  });

  it("substitui os itens da refeição por um só, referenciando o food novo", async () => {
    const meal = mealWithTwoFoods("m1");
    const log = logWith(meal);
    const apply = vi.fn((change: (current: FoodLog) => FoodLog) => change(log));
    const repository = mount(meal, apply);

    await userEvent.click(screen.getByRole("button", { name: "transformar" }));

    await waitFor(() => {
      expect(apply).toHaveBeenCalledTimes(1);
    });
    const [food] = await repository.listAll();
    const result = apply.mock.results[0]?.value as FoodLog;
    expect(result.meals[0]?.items).toHaveLength(1);
    expect(result.meals[0]?.items[0]).toMatchObject({
      foodId: food!.id,
      name: "Marmita de frango",
      grams: 250,
    });
  });

  it("mostra um toast com Desfazer depois de transformar", async () => {
    const meal = mealWithTwoFoods("m1");
    const log = logWith(meal);
    const apply = vi.fn((change: (current: FoodLog) => FoodLog) => change(log));
    mount(meal, apply);

    await userEvent.click(screen.getByRole("button", { name: "transformar" }));

    expect(
      await screen.findByText("Marmita de frango virou 1 alimento no catálogo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeInTheDocument();
  });

  it("Desfazer restaura os itens originais da refeição", async () => {
    const meal = mealWithTwoFoods("m1");
    const log = logWith(meal);
    const apply = vi.fn((change: (current: FoodLog) => FoodLog) => change(log));
    mount(meal, apply);

    await userEvent.click(screen.getByRole("button", { name: "transformar" }));
    await screen.findByRole("button", { name: "Desfazer" });
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));

    await waitFor(() => {
      expect(apply).toHaveBeenCalledTimes(2);
    });
    const restored = apply.mock.results[1]?.value as FoodLog;
    expect(restored.meals[0]?.items).toEqual(meal.items);
  });

  it("recusa um nome em branco, sem criar alimento nem tocar a refeição", async () => {
    // A mesma validação (`customFoodSchema`) que um `onSubmit` já bloqueia
    // antes de chegar aqui — a fábrica precisa se defender sozinha também,
    // não só confiar no formulário.
    const meal = mealWithTwoFoods("m1");
    const log = logWith(meal);
    const apply = vi.fn((change: (current: FoodLog) => FoodLog) => change(log));
    const repository = mount(meal, apply, "   ");

    await userEvent.click(screen.getByRole("button", { name: "transformar" }));

    expect(await repository.listAll()).toHaveLength(0);
    expect(apply).not.toHaveBeenCalled();
  });
});
