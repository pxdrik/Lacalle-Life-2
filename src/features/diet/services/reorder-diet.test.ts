import { describe, expect, it } from "vitest";

import { createDiet, createMealItem } from "./create-diet";
import {
  addItem,
  addMeal,
  moveMeal,
  reorderMealItems,
  reorderMeals,
  updateMeal,
} from "./edit-diet";

const CHICKEN = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };

function dietWithMeals(...names: string[]) {
  let diet = createDiet("Cutting");
  // createDiet already ships one meal; rename it and append the rest.
  diet = updateMeal(diet, diet.meals[0]!.id, {
    name: names[0] ?? "Refeição 1",
  });

  for (const name of names.slice(1)) {
    diet = addMeal(diet);
    diet = updateMeal(diet, diet.meals.at(-1)!.id, { name });
  }

  return diet;
}

const mealNames = (diet: ReturnType<typeof dietWithMeals>) =>
  diet.meals.map((meal) => meal.name);

describe("reorderMeals", () => {
  it("puts the dragged meal where the target was", () => {
    const diet = dietWithMeals("Café", "Almoço", "Jantar");
    const moved = reorderMeals(diet, diet.meals[2]!.id, diet.meals[0]!.id);

    expect(mealNames(moved)).toEqual(["Jantar", "Café", "Almoço"]);
  });

  it("returns the same diet when dropped on itself", () => {
    // No write, and nothing a future sync would read as an edit.
    const diet = dietWithMeals("Café", "Almoço");

    expect(reorderMeals(diet, diet.meals[0]!.id, diet.meals[0]!.id)).toBe(diet);
  });

  it("ignores a meal that is no longer there", () => {
    const diet = dietWithMeals("Café", "Almoço");

    expect(reorderMeals(diet, "gone", diet.meals[0]!.id)).toBe(diet);
  });
});

describe("moveMeal", () => {
  it("moves down", () => {
    const diet = dietWithMeals("Café", "Almoço", "Jantar");

    expect(mealNames(moveMeal(diet, diet.meals[0]!.id, 1))).toEqual([
      "Almoço",
      "Café",
      "Jantar",
    ]);
  });

  it("moves up", () => {
    const diet = dietWithMeals("Café", "Almoço", "Jantar");

    expect(mealNames(moveMeal(diet, diet.meals[2]!.id, -1))).toEqual([
      "Café",
      "Jantar",
      "Almoço",
    ]);
  });

  it("clamps at the ends", () => {
    const diet = dietWithMeals("Café", "Almoço");

    expect(moveMeal(diet, diet.meals[0]!.id, -1)).toBe(diet);
    expect(moveMeal(diet, diet.meals[1]!.id, 1)).toBe(diet);
  });

  it("agrees with dragging: both produce the same order", () => {
    // The arrows and the handle are two doors to one behaviour, and this is
    // what keeps them from drifting apart.
    const diet = dietWithMeals("Café", "Almoço", "Jantar");

    const dragged = reorderMeals(diet, diet.meals[0]!.id, diet.meals[1]!.id);
    const arrowed = moveMeal(diet, diet.meals[0]!.id, 1);

    expect(mealNames(dragged)).toEqual(mealNames(arrowed));
  });
});

describe("Meal.order after a move", () => {
  // `order` is what survives the food log's cross-device merge
  // (`mergeFoodLogMeals`, §19.5) — array position alone does not. A move
  // that changed every meal's `order`, not just the one dragged, would make
  // every bystander meal look edited to that merge. See `edit-diet.ts`.
  it("reorderMeals only changes the order of the meal that moved", () => {
    const diet = dietWithMeals("Café", "Almoço", "Jantar");
    const untouchedIds = [diet.meals[1]!.id, diet.meals[2]!.id];
    const untouchedBefore = untouchedIds.map(
      (id) => diet.meals.find((m) => m.id === id)!.order,
    );

    const moved = reorderMeals(diet, diet.meals[0]!.id, diet.meals[2]!.id);
    const untouchedAfter = untouchedIds.map(
      (id) => moved.meals.find((m) => m.id === id)!.order,
    );

    expect(untouchedAfter).toEqual(untouchedBefore);
  });

  it("moveMeal only changes the order of the meal that moved", () => {
    const diet = dietWithMeals("Café", "Almoço", "Jantar");
    const untouchedIds = [diet.meals[1]!.id, diet.meals[2]!.id];
    const untouchedBefore = untouchedIds.map(
      (id) => diet.meals.find((m) => m.id === id)!.order,
    );

    const moved = moveMeal(diet, diet.meals[0]!.id, 1);
    const untouchedAfter = untouchedIds.map(
      (id) => moved.meals.find((m) => m.id === id)!.order,
    );

    expect(untouchedAfter).toEqual(untouchedBefore);
  });

  it("the moved meal's new order sits between its new neighbors", () => {
    const diet = dietWithMeals("Café", "Almoço", "Jantar");

    const moved = reorderMeals(diet, diet.meals[2]!.id, diet.meals[0]!.id);
    const [first, second, third] = moved.meals;

    expect(first?.name).toBe("Jantar");
    expect(first?.order).toBeLessThan(second!.order!);
    expect(second?.order).toBeLessThan(third!.order!);
  });
});

describe("reorderMealItems", () => {
  function dietWithFoods(...names: string[]) {
    let diet = createDiet("Cutting");
    const mealId = diet.meals[0]!.id;

    for (const name of names) {
      diet = addItem(
        diet,
        mealId,
        createMealItem({ foodId: null, name, grams: 100, per100g: CHICKEN }),
      );
    }

    return { diet, mealId };
  }

  it("reorders within the meal", () => {
    const { diet, mealId } = dietWithFoods("Arroz", "Frango", "Salada");
    const items = diet.meals[0]!.items;

    const moved = reorderMealItems(diet, mealId, items[2]!.id, items[0]!.id);

    expect(moved.meals[0]?.items.map((i) => i.name)).toEqual([
      "Salada",
      "Arroz",
      "Frango",
    ]);
  });

  it("ignores a meal that is no longer there", () => {
    const { diet } = dietWithFoods("Arroz", "Frango");
    const items = diet.meals[0]!.items;

    expect(reorderMealItems(diet, "gone", items[0]!.id, items[1]!.id)).toBe(
      diet,
    );
  });

  it("returns the same diet when nothing moves", () => {
    const { diet, mealId } = dietWithFoods("Arroz", "Frango");
    const items = diet.meals[0]!.items;

    expect(reorderMealItems(diet, mealId, items[0]!.id, items[0]!.id)).toBe(
      diet,
    );
  });

  it("leaves the other meals untouched", () => {
    const { diet: base, mealId } = dietWithFoods("Arroz", "Frango");
    const diet = addMeal(base);
    const secondMeal = structuredClone(diet.meals[1]);

    const items = diet.meals[0]!.items;
    const moved = reorderMealItems(diet, mealId, items[1]!.id, items[0]!.id);

    expect(moved.meals[1]).toEqual(secondMeal);
  });
});
