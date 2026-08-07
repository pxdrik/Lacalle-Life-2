import { reorderById, shiftById } from "@/core/domain/collection";
import { revise, type EntityId } from "@/core/domain/entity";

import type { Diet, Meal, MealItem } from "../types/diet";
import { createMeal } from "./create-diet";

/**
 * Every edit is a pure function from one diet to the next.
 *
 * No component reaches inside a diet to splice an array. That keeps the
 * invariants in one testable place, and it means `updatedAt` is stamped by
 * `revise` on every path — including the ones added later.
 *
 * An operation naming a meal or item that is not there returns the diet
 * unchanged rather than throwing. These are addressed by id from a UI that may
 * be a frame behind the data; a stale click should be a no-op, not a crash.
 */

export function renameDiet(diet: Diet, name: string): Diet {
  return revise(diet, { name });
}

export function addMeal(diet: Diet): Diet {
  return revise(diet, {
    meals: [...diet.meals, createMeal(diet.meals.length + 1)],
  });
}

export function removeMeal(diet: Diet, mealId: EntityId): Diet {
  return revise(diet, {
    meals: diet.meals.filter((meal) => meal.id !== mealId),
  });
}

export type MealChanges = Partial<Pick<Meal, "name" | "time" | "notes">>;

export function updateMeal(
  diet: Diet,
  mealId: EntityId,
  changes: MealChanges,
): Diet {
  return mapMeal(diet, mealId, (meal) => ({ ...meal, ...changes }));
}

export function addItem(diet: Diet, mealId: EntityId, item: MealItem): Diet {
  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    items: [...meal.items, item],
  }));
}

export function removeItem(
  diet: Diet,
  mealId: EntityId,
  itemId: EntityId,
): Diet {
  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    items: meal.items.filter((item) => item.id !== itemId),
  }));
}

/** Moves a meal by `offset`, clamped. What the arrow buttons report. */
export function moveMeal(diet: Diet, mealId: EntityId, offset: number): Diet {
  const meals = shiftById(diet.meals, mealId, offset);
  if (meals === diet.meals) return diet;

  return revise(diet, { meals });
}

/** Puts one meal where another is. What a drag reports. */
export function reorderMeals(
  diet: Diet,
  activeId: EntityId,
  overId: EntityId,
): Diet {
  const meals = reorderById(diet.meals, activeId, overId);
  if (meals === diet.meals) return diet;

  return revise(diet, { meals });
}

export function reorderMealItems(
  diet: Diet,
  mealId: EntityId,
  activeId: EntityId,
  overId: EntityId,
): Diet {
  const meal = diet.meals.find((item) => item.id === mealId);
  if (meal === undefined) return diet;

  const items = reorderById(meal.items, activeId, overId);
  if (items === meal.items) return diet;

  return mapMeal(diet, mealId, (current) => ({ ...current, items }));
}

export function setItemGrams(
  diet: Diet,
  mealId: EntityId,
  itemId: EntityId,
  grams: number,
): Diet {
  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    items: meal.items.map((item) =>
      item.id === itemId ? { ...item, grams } : item,
    ),
  }));
}

/**
 * Applies `change` to one meal, leaving the rest of the diet identical.
 *
 * Returns the original diet — same reference, same `updatedAt` — when the meal
 * is absent, so a no-op never looks like a write to the sync layer.
 */
function mapMeal(
  diet: Diet,
  mealId: EntityId,
  change: (meal: Meal) => Meal,
): Diet {
  if (!diet.meals.some((meal) => meal.id === mealId)) return diet;

  return revise(diet, {
    meals: diet.meals.map((meal) => (meal.id === mealId ? change(meal) : meal)),
  });
}
