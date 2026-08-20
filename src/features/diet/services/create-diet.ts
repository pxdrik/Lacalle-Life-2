import { createEntityId, entityTimestamp } from "@/core/domain/entity";
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
  const now = entityTimestamp();

  return {
    id: createEntityId(),
    name: name.trim(),
    meals: [createMeal(1)],
    weekdays: [],
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
/**
 * A copy of a whole diet.
 *
 * Every id is minted fresh, down to the individual food in a meal. Reusing
 * them would make the two diets share identity: editing a portion in one would
 * be indistinguishable from editing it in the other to anything that addresses
 * by id, and a future sync would treat them as the same record.
 *
 * The name gains a suffix because the copy sits next to the original in a
 * list, where two identical names are a coin toss.
 */
export function duplicateDiet(diet: Diet): Diet {
  const now = entityTimestamp();

  return {
    id: createEntityId(),
    name: `${diet.name} (cópia)`,
    meals: diet.meals.map(copyMeal),
    // Not carried over. A weekday points at one diet at a time (see
    // `assignWeekdays`), and a copy that silently took over the original's
    // days would be a stranger change than "duplicate" promises.
    weekdays: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A meal with fresh ids at every depth.
 *
 * Exported for `duplicateMeal`, which lives with the other meal operations in
 * `edit-diet` — it edits an owner's meal list, and keeping it here while the
 * rest was widened to `MealOwner` is exactly how the food log ended up wiring
 * its "duplicate" button to "add empty meal".
 */
export function copyMeal(meal: Meal): Meal {
  return {
    ...meal,
    id: createEntityId(),
    items: meal.items.map((item) => ({ ...item, id: createEntityId() })),
  };
}

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
    unit: "g",
    per100g: source.per100g,
  };
}
