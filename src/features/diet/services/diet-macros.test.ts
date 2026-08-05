import { describe, expect, it } from "vitest";

import { ZERO_MACROS } from "@/core/domain/macros";

import { createDiet, createMealItem } from "./create-diet";
import { addItem, addMeal } from "./edit-diet";
import { dietMacros, itemMacros, mealMacros } from "./diet-macros";

const CHICKEN = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
const RICE = { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };

const item = (name: string, grams: number, per100g: typeof CHICKEN) =>
  createMealItem({ foodId: null, name, grams, per100g });

describe("itemMacros", () => {
  it("scales to the portion", () => {
    expect(itemMacros(item("Frango", 150, CHICKEN))).toEqual({
      kcal: 248,
      proteinG: 46.5,
      carbsG: 0,
      fatG: 5.4,
    });
  });

  it("is zero for an empty portion", () => {
    expect(itemMacros(item("Frango", 0, CHICKEN))).toEqual(ZERO_MACROS);
  });
});

describe("mealMacros", () => {
  it("is zero for a meal with no food", () => {
    expect(mealMacros(createDiet("Cutting").meals[0]!)).toEqual(ZERO_MACROS);
  });

  it("adds up the portions", () => {
    let diet = createDiet("Cutting");
    const mealId = diet.meals[0]!.id;
    diet = addItem(diet, mealId, item("Frango", 150, CHICKEN));
    diet = addItem(diet, mealId, item("Arroz", 100, RICE));

    expect(mealMacros(diet.meals[0]!)).toEqual({
      kcal: 378,
      proteinG: 49.2,
      carbsG: 28,
      fatG: 5.7,
    });
  });

  it("shows a total equal to the sum of the rows above it", () => {
    let diet = createDiet("Cutting");
    const mealId = diet.meals[0]!.id;
    diet = addItem(diet, mealId, item("Frango", 33, CHICKEN));
    diet = addItem(diet, mealId, item("Arroz", 67, RICE));
    diet = addItem(diet, mealId, item("Frango", 149, CHICKEN));

    const meal = diet.meals[0]!;
    const byHand = meal.items.reduce((sum, i) => sum + itemMacros(i).proteinG, 0);

    expect(mealMacros(meal).proteinG).toBeCloseTo(byHand, 10);
  });
});

describe("dietMacros", () => {
  it("is zero for a new diet", () => {
    expect(dietMacros(createDiet("Cutting"))).toEqual(ZERO_MACROS);
  });

  it("adds up every meal", () => {
    let diet = addMeal(createDiet("Cutting"));
    diet = addItem(diet, diet.meals[0]!.id, item("Frango", 100, CHICKEN));
    diet = addItem(diet, diet.meals[1]!.id, item("Arroz", 100, RICE));

    expect(dietMacros(diet)).toEqual({
      kcal: 295,
      proteinG: 33.7,
      carbsG: 28,
      fatG: 3.9,
    });
  });

  it("equals the sum of its meals", () => {
    let diet = addMeal(createDiet("Cutting"));
    diet = addItem(diet, diet.meals[0]!.id, item("Frango", 137, CHICKEN));
    diet = addItem(diet, diet.meals[1]!.id, item("Arroz", 213, RICE));

    const byMeal = diet.meals.reduce((sum, m) => sum + mealMacros(m).kcal, 0);

    expect(dietMacros(diet).kcal).toBe(byMeal);
  });
});
