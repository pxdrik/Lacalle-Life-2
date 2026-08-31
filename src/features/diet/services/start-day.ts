import { createEntityId, entityTimestamp } from "@/core/domain/entity";

import type { Diet, Meal } from "../types/diet";
import type { FoodLog } from "../types/food-log";

/** A day with nothing in it yet. */
export function createFoodLog(day: string): FoodLog {
  const now = entityTimestamp();

  return {
    id: day,
    day,
    meals: [],
    dietId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Takes the photograph — the diet, copied into a day.
 *
 * Every id is minted fresh, down to each item, so the day and the diet share
 * no reference at all. That is what makes their independence structural rather
 * than a rule somebody has to remember: editing the diet next week has nothing
 * in common with this Tuesday to reach into.
 *
 * The macros come along in the copy because a `MealItem` already carries its
 * own. Looking them up later would read whatever the food says *then*, and a
 * corrected label in August would silently rewrite what March recorded.
 *
 * Portions are copied as planned, which makes the common case — eating roughly
 * what was planned — a matter of adjusting a few numbers rather than building
 * the day from nothing.
 *
 * Each copied meal is stamped with `sourceDietId`/`sourceMealId` — the same
 * pair `checkMeal` in `meal-execution.ts` stamps for a single meal. Starting
 * the whole day this way is "I ate everything as planned", so every meal in
 * it should already read as checked on the diet screen; without the stamp,
 * checking one of them there would add a second, redundant copy here.
 * `plannedSnapshot` rides along for the same reason `checkMeal` sets it: a
 * meal edited afterwards should read as "comido, mas diferente", not as
 * still exactly the plan.
 */
export function startDayFromDiet(diet: Diet, day: string): FoodLog {
  const now = entityTimestamp();

  const meals: Meal[] = diet.meals.map((meal) => {
    const items = meal.items.map((item) => ({ ...item, id: createEntityId() }));

    return {
      id: createEntityId(),
      name: meal.name,
      time: meal.time,
      notes: meal.notes,
      items,
      sourceDietId: diet.id,
      sourceMealId: meal.id,
      plannedSnapshot: items,
    };
  });

  return {
    id: day,
    day,
    meals,
    dietId: diet.id,
    createdAt: now,
    updatedAt: now,
  };
}
