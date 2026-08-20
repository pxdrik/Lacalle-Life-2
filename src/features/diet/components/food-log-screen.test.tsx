import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { dayKey } from "@/core/format/day";
import { MemoryStore } from "@/core/storage/memory-store";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";
import type { Food } from "@/features/foods";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import { ProfileRepositoryProvider } from "@/features/profile/data/profile-repository-context";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { DIETS_STORE } from "../data/diet-store";
import { FOOD_LOGS_STORE } from "../data/food-log-repository";
import { FoodLogRepositoryProvider } from "../data/food-log-repository-context";
import { LocalDietRepository } from "../data/local-diet-repository";
import { LocalFoodLogRepository } from "../data/local-food-log-repository";
import type { Diet } from "../types/diet";
import type { FoodLog } from "../types/food-log";
import { FoodLogScreen } from "./food-log-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/**
 * The diary reuses the diet editor's machinery — `MealCard`, the meal
 * operations, the totals. That reuse is the point, and it is also the risk:
 * every control has to be wired to the operation it names, and nothing about
 * a shared component makes that true on its own.
 *
 * It was not true. "Duplicar" on the diary was wired to `addMeal`, so a button
 * promising a copy produced an empty meal instead — silently, on the screen
 * where somebody is recording what they actually ate.
 */

const TODAY = dayKey(new Date());

function logWithMeal(): FoodLog {
  return {
    id: TODAY,
    day: TODAY,
    dietId: null,
    meals: [
      {
        id: "m1",
        name: "Café da manhã",
        time: null,
        notes: "",
        items: [
          {
            id: "i1",
            foodId: "ovo-inteiro",
            name: "Ovo inteiro",
            grams: 100,
            unit: "g",
            per100g: { kcal: 143, proteinG: 13, carbsG: 1, fatG: 10 },
          },
        ],
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

function mount(seed: FoodLog) {
  const logs = new LocalFoodLogRepository(
    new MemoryStore<FoodLog>(FOOD_LOGS_STORE),
  );
  const diets = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const foods = new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));
  const profile = new LocalProfileRepository(new MemoryStore(PROFILE_STORE));

  const ready = logs.save(seed, null);

  render(
    <FoodLogRepositoryProvider repository={ready.then(() => logs)}>
      <DietRepositoryProvider repository={ready.then(() => diets)}>
        <FoodRepositoryProvider repository={ready.then(() => foods)}>
          <ProfileRepositoryProvider repository={ready.then(() => profile)}>
            <FoodLogScreen day={TODAY} />
          </ProfileRepositoryProvider>
        </FoodRepositoryProvider>
      </DietRepositoryProvider>
    </FoodLogRepositoryProvider>,
  );

  return logs;
}

describe("duplicating a meal in the diary", () => {
  it("copies the food in it, rather than adding an empty meal", async () => {
    const logs = mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    await userEvent.click(
      screen.getByRole("button", { name: "Duplicar Café da manhã" }),
    );

    await waitFor(async () => {
      const saved = await logs.getByDay(TODAY);
      expect(saved?.meals).toHaveLength(2);
      expect(saved?.meals[1]?.items).toHaveLength(1);
      expect(saved?.meals[1]?.items[0]?.name).toBe("Ovo inteiro");
    });
  });

  it("keeps the copy's name, and gives it fresh ids at every depth", async () => {
    const logs = mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    await userEvent.click(
      screen.getByRole("button", { name: "Duplicar Café da manhã" }),
    );

    await waitFor(async () => {
      const saved = await logs.getByDay(TODAY);
      const [original, copy] = saved?.meals ?? [];

      expect(copy?.name).toBe("Café da manhã");
      expect(copy?.id).not.toBe(original?.id);
      expect(copy?.items[0]?.id).not.toBe(original?.items[0]?.id);
    });
  });
});

describe("navigating to a future day", () => {
  // Passou a ser permitido: é como alguém confere se a dieta vinculada a um
  // dia da semana (`dietForWeekday`) caiu no dia certo antes de a semana
  // chegar lá. O Diário continua sem escrever nada sozinho — só passou a
  // deixar olhar.
  it("does not disable 'Próximo dia' on today", async () => {
    mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    expect(screen.getByRole("button", { name: "Próximo dia" })).toBeEnabled();
  });

  it("does not cap the date field at today", async () => {
    mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    expect(screen.getByLabelText("Dia do registro")).not.toHaveAttribute(
      "max",
    );
  });
});
