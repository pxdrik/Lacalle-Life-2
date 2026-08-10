import { reorderById, shiftById } from "@/core/domain/collection";
import {
  createEntityId,
  revise,
  type Entity,
  type EntityId,
} from "@/core/domain/entity";

import type { Diet, Meal, MealItem, MealOwner } from "../types/diet";
import { copyMeal, createMeal } from "./create-diet";

/**
 * Every edit is a pure function from one meal owner to the next.
 *
 * **The parameter is called `diet` for history, but the type is `MealOwner`**
 * — these run on a plan and on a day's log alike. Widening them is what let
 * the food log reuse the whole editing layer, and `MealCard` with it, instead
 * of growing a parallel copy that would drift.
 *
 * No component reaches inside to splice an array. That keeps the invariants in
 * one testable place, and it means `updatedAt` is stamped by `revise` on every
 * path — including the ones added later.
 *
 * An operation naming a meal or item that is not there returns the input
 * unchanged rather than throwing. These are addressed by id from a UI that may
 * be a frame behind the data; a stale click should be a no-op, not a crash.
 */

/**
 * `revise` with the meal list replaced.
 *
 * The assertion lives here and nowhere else. TypeScript cannot prove that a
 * plain `readonly Meal[]` satisfies `T["meals"]` for an arbitrary
 * `T extends MealOwner`, because a subtype could narrow it further. None does,
 * and confining the claim to one line keeps the assumption visible instead of
 * repeating it at five call sites.
 */
function withMeals<T extends MealOwner>(owner: T, meals: readonly Meal[]): T {
  return revise(owner, { meals } as Partial<Omit<T, keyof Entity>>);
}

export function renameDiet(diet: Diet, name: string): Diet {
  return revise(diet, { name });
}

export function addMeal<T extends MealOwner>(diet: T): T {
  return withMeals(diet, [...diet.meals, createMeal(diet.meals.length + 1)]);
}

export function removeMeal<T extends MealOwner>(diet: T, mealId: EntityId): T {
  return withMeals(
    diet,
    diet.meals.filter((meal) => meal.id !== mealId),
  );
}

/**
 * A copy of one meal, inserted directly below the original.
 *
 * The name is left alone, unlike a duplicated diet: inside a document the copy
 * is obviously distinct by its position, and someone duplicating "Almoço" is
 * usually about to make it "Jantar" — a "(cópia)" they would have to delete
 * first is work, not help.
 */
export function duplicateMeal<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
): T {
  const index = diet.meals.findIndex((meal) => meal.id === mealId);
  if (index === -1) return diet;

  const meals = [...diet.meals];
  meals.splice(index + 1, 0, copyMeal(diet.meals[index]!));

  return withMeals(diet, meals);
}

export type MealChanges = Partial<Pick<Meal, "name" | "time" | "notes">>;

export function updateMeal<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  changes: MealChanges,
): T {
  return mapMeal(diet, mealId, (meal) => ({ ...meal, ...changes }));
}

export function addItem<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  item: MealItem,
): T {
  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    items: [...meal.items, item],
  }));
}

export function removeItem<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  itemId: EntityId,
): T {
  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    items: meal.items.filter((item) => item.id !== itemId),
  }));
}

/** Moves a meal by `offset`, clamped. What the arrow buttons report. */
export function moveMeal<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  offset: number,
): T {
  const meals = shiftById(diet.meals, mealId, offset);
  if (meals === diet.meals) return diet;

  return withMeals(diet, meals);
}

/** Puts one meal where another is. What a drag reports. */
export function reorderMeals<T extends MealOwner>(
  diet: T,
  activeId: EntityId,
  overId: EntityId,
): T {
  const meals = reorderById(diet.meals, activeId, overId);
  if (meals === diet.meals) return diet;

  return withMeals(diet, meals);
}

export function reorderMealItems<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  activeId: EntityId,
  overId: EntityId,
): T {
  const meal = diet.meals.find((item) => item.id === mealId);
  if (meal === undefined) return diet;

  const items = reorderById(meal.items, activeId, overId);
  if (items === meal.items) return diet;

  return mapMeal(diet, mealId, (current) => ({ ...current, items }));
}

/**
 * Copies a food into another meal, leaving the original where it is.
 *
 * A fresh id on the copy, so adjusting the portion in one meal does not move
 * the other. The macros travel with it — a meal item already carries its own
 * copy of them, so nothing is looked up and nothing can drift.
 */
export function copyItemToMeal<T extends MealOwner>(
  diet: T,
  fromMealId: EntityId,
  itemId: EntityId,
  toMealId: EntityId,
): T {
  const item = findItem(diet, fromMealId, itemId);
  if (item === undefined || fromMealId === toMealId) return diet;
  if (!diet.meals.some((meal) => meal.id === toMealId)) return diet;

  return addItem(diet, toMealId, { ...item, id: createEntityId() });
}

/** Moves a food to another meal. The id travels with it; it is the same food. */
export function moveItemToMeal<T extends MealOwner>(
  diet: T,
  fromMealId: EntityId,
  itemId: EntityId,
  toMealId: EntityId,
): T {
  const item = findItem(diet, fromMealId, itemId);
  if (item === undefined || fromMealId === toMealId) return diet;
  if (!diet.meals.some((meal) => meal.id === toMealId)) return diet;

  return addItem(removeItem(diet, fromMealId, itemId), toMealId, item);
}

function findItem<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  itemId: EntityId,
): MealItem | undefined {
  return diet.meals
    .find((meal) => meal.id === mealId)
    ?.items.find((item) => item.id === itemId);
}

export function setItemGrams<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  itemId: EntityId,
  grams: number,
): T {
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
function mapMeal<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  change: (meal: Meal) => Meal,
): T {
  if (!diet.meals.some((meal) => meal.id === mealId)) return diet;

  return withMeals(
    diet,
    diet.meals.map((meal) => (meal.id === mealId ? change(meal) : meal)),
  );
}
