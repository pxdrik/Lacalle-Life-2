import { reorderById, shiftById } from "@/core/domain/collection";
import {
  createEntityId,
  entityTimestamp,
  revise,
  type Entity,
  type EntityId,
} from "@/core/domain/entity";

import type {
  Diet,
  Meal,
  MealAlternative,
  MealItem,
  MealOwner,
} from "../types/diet";
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

  const copy: Meal = {
    ...copyMeal(diet.meals[index]!),
    order: orderBetween(
      effectiveOrder(diet.meals, index),
      index + 1 < diet.meals.length
        ? effectiveOrder(diet.meals, index + 1)
        : undefined,
    ),
  };
  const meals = [...diet.meals];
  meals.splice(index + 1, 0, copy);

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

/**
 * `meal.order`, or its position in `meals` when the field predates that
 * meal — see `Meal.order`.
 */
function effectiveOrder(meals: readonly Meal[], index: number): number {
  return meals[index]?.order ?? index;
}

/**
 * A value strictly between two neighbors, so a move only ever has to change
 * the `order` of the one meal that actually moved — every other meal in the
 * list keeps the value it already had, which is what keeps a reorder from
 * looking like an edit to any meal beside the one dragged (see `Meal.order`
 * and `mergeFoodLogMeals` in `composition/sync/food-log-merge.ts`, the
 * reason this field exists at all).
 *
 * `undefined` on either side means an edge of the list, not a legacy meal —
 * callers pass `effectiveOrder`'s already-defaulted result for anything that
 * exists, so `undefined` here only ever means "there is no neighbor there."
 *
 * ponytail: two flat numbers, not a fractional-index library — precision
 * only degrades after dozens of consecutive drops into the exact same slot,
 * which does not happen in a list of a handful of meals. Upgrade path if it
 * ever does: renumber the whole array on that one collision.
 */
function orderBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined) {
    return after === undefined ? entityTimestamp() : after - 1;
  }
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

/** Re-derives `order` for `mealId` from its new neighbors after a move. */
function restampMoved<T extends Meal>(meals: readonly T[], mealId: EntityId): readonly T[] {
  const index = meals.findIndex((meal) => meal.id === mealId);
  if (index === -1) return meals;

  const order = orderBetween(
    index > 0 ? effectiveOrder(meals, index - 1) : undefined,
    index < meals.length - 1 ? effectiveOrder(meals, index + 1) : undefined,
  );

  return meals.map((meal, i) => (i === index ? { ...meal, order } : meal));
}

/** Moves a meal by `offset`, clamped. What the arrow buttons report. */
export function moveMeal<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  offset: number,
): T {
  const meals = shiftById(diet.meals, mealId, offset);
  if (meals === diet.meals) return diet;

  return withMeals(diet, restampMoved(meals, mealId));
}

/** Puts one meal where another is. What a drag reports. */
export function reorderMeals<T extends MealOwner>(
  diet: T,
  activeId: EntityId,
  overId: EntityId,
): T {
  const meals = reorderById(diet.meals, activeId, overId);
  if (meals === diet.meals) return diet;

  return withMeals(diet, restampMoved(meals, activeId));
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

export type MealItemDetailChanges = Partial<
  Pick<MealItem, "brand" | "saturatedFatG" | "sodiumMg" | "fiberG" | "sugarG">
>;

/**
 * RM02's detail page — the one surface that edits the four optional
 * nutrients (and the brand) after a food was already added. `undefined` in
 * `changes` clears a field back to "not informed" rather than leaving it
 * alone, the same as every other field this function touches: the page
 * sends the whole current form on every save, not a diff.
 */
export function updateMealItemDetails<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  itemId: EntityId,
  changes: MealItemDetailChanges,
): T {
  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    items: meal.items.map((item) =>
      item.id === itemId ? { ...item, ...changes } : item,
    ),
  }));
}

/**
 * "Transformar em 1 alimento" (`useConsolidateMeal`, roadmap 23/09/2026,
 * extended 24/09/2026) — installs `items` and freezes what the meal had
 * right before into `consolidatedFrom`, so "Desfazer" stays available from
 * the meal's own ⋮ menu any time later, not only from the toast that fired
 * at the moment of the transformation.
 *
 * Overwrites a previous `consolidatedFrom` outright if the meal was
 * consolidated once already and grew new items since — undo always
 * reverts one step, to whatever came right before the latest
 * transformation, not to some deeper history.
 */
export function consolidateMealItems<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  items: readonly MealItem[],
): T {
  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    items,
    consolidatedFrom: meal.items,
  }));
}

/**
 * The undo — restores `items` from `consolidatedFrom` and clears it, so a
 * second click (or a stale one, after the meal changed some other way)
 * finds nothing to restore and leaves the meal alone rather than firing
 * again. The `Food` the original transformation created stays in the
 * catalogue either way — deletable from Alimentos like any other custom
 * food, same as if it had been added by hand and then removed.
 */
export function undoConsolidateMealItems<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
): T {
  const items = diet.meals.find((meal) => meal.id === mealId)?.consolidatedFrom;
  if (items === undefined) return diet;

  return mapMeal(diet, mealId, (current) => ({
    ...current,
    items,
    consolidatedFrom: undefined,
  }));
}

/**
 * Snapshots the meal's current foods as a new named suggestion.
 *
 * The only way `alternatives` ever gains an entry — nothing here tries to
 * infer one automatically. Fresh ids on the copy, same reason `copyMeal`
 * mints them: this snapshot must not move if the live meal is edited
 * afterwards.
 */
export function saveMealAsAlternative<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  name: string,
): T {
  const trimmed = name.trim();
  if (trimmed === "") return diet;

  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    alternatives: [
      ...(meal.alternatives ?? []),
      {
        id: createEntityId(),
        name: trimmed,
        items: meal.items.map((item) => ({ ...item, id: createEntityId() })),
      },
    ],
  }));
}

/**
 * Swaps in a saved suggestion as the meal's live foods.
 *
 * The previous `items` are simply replaced, not folded back into
 * `alternatives` — swapping to "Marmita de arroz" without having saved
 * whatever was live before must not invent a name for it. Anyone who wants
 * that back saves it first, the same one way anything ever lands here.
 */
export function applyMealAlternative<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  alternativeId: EntityId,
): T {
  const alternative = findAlternative(diet, mealId, alternativeId);
  if (alternative === undefined) return diet;

  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    items: alternative.items.map((item) => ({
      ...item,
      id: createEntityId(),
    })),
  }));
}

export function renameMealAlternative<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  alternativeId: EntityId,
  name: string,
): T {
  const trimmed = name.trim();
  if (trimmed === "" || findAlternative(diet, mealId, alternativeId) === undefined) {
    return diet;
  }

  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    alternatives: meal.alternatives?.map((alternative) =>
      alternative.id === alternativeId
        ? { ...alternative, name: trimmed }
        : alternative,
    ),
  }));
}

function findAlternative<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  alternativeId: EntityId,
): MealAlternative | undefined {
  return diet.meals
    .find((meal) => meal.id === mealId)
    ?.alternatives?.find((alternative) => alternative.id === alternativeId);
}

export function removeMealAlternative<T extends MealOwner>(
  diet: T,
  mealId: EntityId,
  alternativeId: EntityId,
): T {
  if (findAlternative(diet, mealId, alternativeId) === undefined) return diet;

  return mapMeal(diet, mealId, (meal) => ({
    ...meal,
    alternatives: meal.alternatives?.filter(
      (alternative) => alternative.id !== alternativeId,
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
