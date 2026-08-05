import { createEntityId } from "@/core/domain/entity";
import type { Macros } from "@/core/domain/macros";

import type { Diet, Meal, MealItem } from "../types/diet";

/**
 * A new diet arrives with one empty meal.
 *
 * Not three named ones: assuming breakfast/lunch/dinner imposes a schedule the
 * user did not ask for, and someone eating five times a day would start by
 * deleting things. One meal is the smallest structure that lets the next click
 * be "add a food" rather than "add a meal, then add a food".
 */
export function createDiet(name: string): Diet {
  const now = Date.now();

  return {
    id: createEntityId(),
    name: name.trim(),
    meals: [createMeal(1)],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The portion a food is added with. 100 g because that is the unit every
 * value in the catalogue is stated in, so the first numbers a user sees after
 * adding are the ones printed on the label.
 */
export const DEFAULT_GRAMS = 100;

export function createMeal(position: number): Meal {
  return {
    id: createEntityId(),
    name: `Refeição ${position}`,
    time: null,
    notes: "",
    items: [],
  };
}

/**
 * Copies the food's values into the meal.
 *
 * The copy is the point: a diet records what the user decided, and editing or
 * deleting the catalogue entry afterwards must not rewrite it.
 */
export function createMealItem(source: {
  readonly foodId: string | null;
  readonly name: string;
  readonly grams: number;
  readonly per100g: Macros;
}): MealItem {
  return {
    id: createEntityId(),
    foodId: source.foodId,
    name: source.name,
    grams: source.grams,
    per100g: source.per100g,
  };
}
