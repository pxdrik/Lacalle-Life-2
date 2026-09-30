import { createEntityId, entityTimestamp } from "@/core/domain/entity";
import type { Macros } from "@/core/domain/macros";
import type { FoodUnit, PracticalUnit } from "@/features/foods";

import type { Diet, Meal, MealItem } from "../types/diet";

/**
 * A new diet arrives with one empty meal.
 *
 * Not three named ones: assuming breakfast/lunch/dinner imposes a schedule the
 * user did not ask for, and someone eating five times a day would start by
 * deleting things. One meal is the smallest structure that lets the next click
 * be "add a food" rather than "add a meal, then add a food".
 *
 * Still one meal — but since 30/09/2026 it is *named* like the first of
 * `DEFAULT_MEAL_NAMES` instead of "Refeição 1" (Pedro, roadmap 7.3): the same
 * name written the same way every day is what lets "Igual a ontem?" find the
 * meal it is looking for.
 */
export function createDiet(name: string): Diet {
  const now = entityTimestamp();

  return {
    id: createEntityId(),
    name: name.trim(),
    meals: [createMeal(1, DEFAULT_MEAL_NAMES[0])],
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

/**
 * Os nomes que uma refeição nova recebe, nesta ordem (Pedro, 30/09/2026,
 * roadmap 7.3). Quem não faz essas refeições renomeia; depois dos quatro, as
 * seguintes voltam a "Refeição N".
 */
export const DEFAULT_MEAL_NAMES = [
  "Café da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
] as const;

/**
 * Um nome de refeição comparável: sem acento, sem maiúsculas, sem espaço
 * sobrando. "cafe da manha" e "Café da  manhã " são a mesma refeição — é o
 * que deixa "Igual a ontem?" achar a de ontem mesmo escrita de outro jeito.
 */
export function normalizeMealName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

/**
 * O nome da próxima refeição: o primeiro de `DEFAULT_MEAL_NAMES` que ainda
 * não existe (comparando por `normalizeMealName`), senão "Refeição N". Nunca
 * repete um nome que já está lá.
 */
export function nextMealName(
  existing: readonly { readonly name: string }[],
  position: number,
): string {
  const used = new Set(existing.map((meal) => normalizeMealName(meal.name)));
  return (
    DEFAULT_MEAL_NAMES.find((name) => !used.has(normalizeMealName(name))) ??
    `Refeição ${String(position)}`
  );
}

export function createMeal(
  position: number,
  name = `Refeição ${String(position)}`,
): Meal {
  return {
    id: createEntityId(),
    name,
    time: null,
    notes: "",
    items: [],
    // Always the newest value `entityTimestamp()` has produced in this
    // process, so a fresh meal sorts after every meal already in the list —
    // see `Meal.order`.
    order: entityTimestamp(),
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
    alternatives: meal.alternatives?.map((alternative) => ({
      ...alternative,
      id: createEntityId(),
      items: alternative.items.map((item) => ({
        ...item,
        id: createEntityId(),
      })),
    })),
  };
}

export function createMealItem(source: {
  readonly foodId: string | null;
  readonly name: string;
  readonly grams: number;
  /** Defaults to `"g"` — every caller that predates liquid foods relies on this. */
  readonly unit?: FoodUnit | undefined;
  readonly per100g: Macros;
  readonly practicalUnit?: PracticalUnit | undefined;
  /** RM02 — copied straight through from the picked `Food`, same as `practicalUnit`. See `MealItem.brand`. */
  readonly brand?: string | undefined;
  readonly saturatedFatG?: number | undefined;
  readonly sodiumMg?: number | undefined;
  readonly fiberG?: number | undefined;
  readonly sugarG?: number | undefined;
}): MealItem {
  return {
    id: createEntityId(),
    foodId: source.foodId,
    name: source.name,
    grams: source.grams,
    unit: source.unit ?? "g",
    per100g: source.per100g,
    brand: source.brand,
    saturatedFatG: source.saturatedFatG,
    sodiumMg: source.sodiumMg,
    fiberG: source.fiberG,
    sugarG: source.sugarG,
    practicalUnit: source.practicalUnit,
  };
}
