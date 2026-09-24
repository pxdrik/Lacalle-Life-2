import {
  per100gFrom,
  roundMacros,
  scaleMacros,
  sumMacros,
  type Macros,
} from "@/core/domain/macros";

import type { Meal, MealItem, MealOwner } from "../types/diet";

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

/** Totals for anything that owns meals — a plan or a day that happened. */
export function dietMacros(owner: MealOwner): Macros {
  return sumMacros(owner.meals.map(mealMacros));
}

/**
 * The real combined weight of a meal, and the per-100 g density that
 * describes it — what "transformar em 1 alimento" (`useConsolidateMeal`,
 * roadmap 23/09/2026) needs to turn several foods into one that still means
 * something as a portion later.
 *
 * The density comes from `mealMacros` — the same rounded total the screen
 * already shows — not from raw per-item precision, so the number on screen
 * does not move when the rows collapse into one.
 */
export function combinedMealTotals(meal: Meal): {
  readonly totalGrams: number;
  readonly per100g: Macros;
} {
  const totalGrams = meal.items.reduce((sum, item) => sum + item.grams, 0);
  return { totalGrams, per100g: per100gFrom(mealMacros(meal), totalGrams) };
}
