import { createEntityId, revise, type EntityId } from "@/core/domain/entity";

import type { Diet, Meal } from "../types/diet";
import type { FoodLog } from "../types/food-log";

/**
 * "Comi esta refeição" — the bridge between a plan and what happened.
 *
 * A check does not copy the meal into the log on every click, and it is not
 * a live link either: it takes one snapshot, the moment it is checked, the
 * same way `startDayFromDiet` takes one snapshot of the whole diet. Editing
 * the diet afterwards — a corrected portion, a renamed meal — must not
 * reach into a day already recorded, for the same reason `startDayFromDiet`
 * mints fresh ids at every depth: the two have to share no reference at all
 * for that independence to be structural rather than a rule to remember.
 *
 * Identity is `sourceDietId` + `sourceMealId`, both stamped on the copy and
 * never on a `Diet`'s own meals. That pair is what makes "checked" a
 * question the diet screen can ask of a day's log — `isMealChecked` and,
 * once "editado depois de marcado" needed its own state, `mealCheckState`
 * — and what stops a second click from adding a second copy.
 */

/** Whether `day`'s log already holds a snapshot of this exact meal. */
export function isMealChecked(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): boolean {
  return log.meals.some(
    (meal) => meal.sourceDietId === dietId && meal.sourceMealId === mealId,
  );
}

/**
 * Adds a snapshot of `meal`, stamped with where it came from.
 *
 * A no-op if the log already has one — the same "stale click" convention
 * `edit-diet.ts`'s operations follow, here guarding against a genuine
 * double click rather than a race with a deleted meal.
 */
export function checkMeal(log: FoodLog, diet: Diet, meal: Meal): FoodLog {
  if (isMealChecked(log, diet.id, meal.id)) return log;

  const items = meal.items.map((item) => ({ ...item, id: createEntityId() }));

  const snapshot: Meal = {
    id: createEntityId(),
    name: meal.name,
    time: meal.time,
    notes: meal.notes,
    items,
    sourceDietId: diet.id,
    sourceMealId: meal.id,
    // The same array as `items`, not a second copy of it — see
    // `mealCheckState` below, which is what this pays for.
    plannedSnapshot: items,
  };

  return revise(log, { meals: [...log.meals, snapshot] });
}

export type MealCheckState = "unchecked" | "checked" | "edited";

/**
 * `"unchecked"`, `"checked"`, or `"edited"` — the third state nobody sets on
 * purpose. Every `edit-diet.ts` operation replaces `items` with a new array
 * rather than mutating one in place, so a meal whose `items` still *is*
 * (`===`) the array `checkMeal` stamped as `plannedSnapshot` has not been
 * touched since; any edit in the Diário — a portion changed, a food swapped
 * — necessarily produces a different array, and reference equality is
 * exactly the question "does this still match what was checked".
 */
export function mealCheckState(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): MealCheckState {
  const meal = log.meals.find(
    (candidate) =>
      candidate.sourceDietId === dietId && candidate.sourceMealId === mealId,
  );
  if (meal === undefined) return "unchecked";

  return meal.items === meal.plannedSnapshot ? "checked" : "edited";
}

/** Removes the snapshot of this meal, if one is checked. A no-op otherwise. */
export function uncheckMeal(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): FoodLog {
  const meals = log.meals.filter(
    (meal) => !(meal.sourceDietId === dietId && meal.sourceMealId === mealId),
  );
  if (meals.length === log.meals.length) return log;

  return revise(log, { meals });
}

/** Checks `meal` if it is not already, unchecks it if it is. */
export function toggleMealChecked(
  log: FoodLog,
  diet: Diet,
  meal: Meal,
): FoodLog {
  return isMealChecked(log, diet.id, meal.id)
    ? uncheckMeal(log, diet.id, meal.id)
    : checkMeal(log, diet, meal);
}
