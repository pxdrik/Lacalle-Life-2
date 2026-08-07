import { createEntityId, revise } from "@/core/domain/entity";

import type { Food } from "../types/food";
import type { CustomFoodInput } from "../validation/food-schema";

/**
 * Builds a user-created food.
 *
 * Kept out of the form component so that identity and timestamps are decided
 * in one place — a component that assembles its own entities is a component
 * that eventually forgets a field.
 */
export function createCustomFood(input: CustomFoodInput): Food {
  const now = Date.now();

  return {
    id: createEntityId(),
    name: input.name.trim(),
    category: input.category,
    per100g: input.per100g,
    isCustom: true,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Applies an edit to a food the user created.
 *
 * Keeps the id, so every diet already pointing at this food follows the
 * correction instead of being orphaned — a typo in the protein value is fixed
 * everywhere it was ever used. Keeps `createdAt` and `isFavorite` for the same
 * reason: neither is what the person came here to change.
 *
 * Note what this does **not** do: `MealItem` copies macros at the moment a
 * food is added to a meal, so editing a food does not retroactively rewrite
 * meals built with it. That is deliberate and predates this function — a diet
 * from March should not silently change because a number was corrected in
 * August.
 */
export function updateCustomFood(food: Food, input: CustomFoodInput): Food {
  return revise(food, {
    name: input.name.trim(),
    category: input.category,
    per100g: input.per100g,
  });
}

/**
 * Atwater factors, offered to the form as a suggestion rather than applied.
 *
 * They overestimate anything with meaningful fibre — which yields ~2 kcal/g,
 * not 4 — so a packet's printed value always wins over this number. It exists
 * to catch a typo, not to replace the label.
 */
export function estimateKcal(macros: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}): number {
  return Math.round(4 * macros.proteinG + 4 * macros.carbsG + 9 * macros.fatG);
}
