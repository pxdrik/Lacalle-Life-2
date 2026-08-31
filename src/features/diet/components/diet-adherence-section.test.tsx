import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { DIETS_STORE } from "../data/diet-store";
import { FOOD_LOGS_STORE } from "../data/food-log-repository";
import { FoodLogRepositoryProvider } from "../data/food-log-repository-context";
import { LocalDietRepository } from "../data/local-diet-repository";
import { LocalFoodLogRepository } from "../data/local-food-log-repository";
import { assignWeekdays } from "../services/diet-schedule";
import { createDiet, createMealItem } from "../services/create-diet";
import { addItem } from "../services/edit-diet";
import type { Diet } from "../types/diet";
import type { FoodLog } from "../types/food-log";
import { DietAdherenceSection } from "./diet-adherence-section";

function mount(diets: readonly Diet[]) {
  const dietStore = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const foodLogStore = new LocalFoodLogRepository(
    new MemoryStore<FoodLog>(FOOD_LOGS_STORE),
  );

  const ready = Promise.all(diets.map((diet) => dietStore.save(diet, null)));

  render(
    <DietRepositoryProvider repository={ready.then(() => dietStore)}>
      <FoodLogRepositoryProvider repository={Promise.resolve(foodLogStore)}>
        <DietAdherenceSection />
      </FoodLogRepositoryProvider>
    </DietRepositoryProvider>,
  );
}

describe("DietAdherenceSection", () => {
  it("points at Dietas when no diet is scheduled to any weekday", async () => {
    const diet = createDiet("Cutting");
    mount([diet]);

    expect(
      await screen.findByText("Nenhuma dieta vinculada a dias da semana."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para as dietas" })).toHaveAttribute(
      "href",
      "/dietas",
    );
  });

  it("shows the chart once a diet is scheduled", async () => {
    let diet = createDiet("Cutting");
    diet = addItem(
      diet,
      diet.meals[0]!.id,
      createMealItem({
        foodId: "ovo",
        name: "Ovo",
        grams: 100,
        per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      }),
    );
    diet = assignWeekdays([diet], diet.id, ["mon"])[0]!;
    mount([diet]);

    expect(await screen.findByText("Aderência semanal")).toBeInTheDocument();
  });
});
