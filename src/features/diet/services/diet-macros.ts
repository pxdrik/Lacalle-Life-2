import {
  roundMacros,
  scaleMacros,
  sumMacros,
  type Macros,
} from "@/core/domain/macros";

import type { Diet, Meal, MealItem } from "../types/diet";

/**
 * What one portion contributes, at display precision.
 *
 * Rounded here rather than at the total, so the column on screen adds up to
 * the figure printed beneath it.
 */
export function itemMacros(item: MealItem): Macros {
  return roundMacros(scaleMacros(item.per100g, item.grams));
}

export function mealMacros(meal: Meal): Macros {
  return sumMacros(meal.items.map(itemMacros));
}

export function dietMacros(diet: Diet): Macros {
  return sumMacros(diet.meals.map(mealMacros));
}
