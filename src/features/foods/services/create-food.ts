import { createEntityId } from "@/core/domain/entity";

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
