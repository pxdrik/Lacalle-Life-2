import type { Entity, EntityId } from "@/core/domain/entity";
import type { Macros } from "@/core/domain/macros";

/**
 * One food in one meal.
 *
 * `per100g` is **copied** from the catalogue when the item is added, not
 * looked up. A diet is a record of a decision: correcting a food's macros, or
 * deleting it outright, must never silently rewrite a plan the user already
 * built and trusts. `foodId` is kept only as provenance.
 *
 * Not an `Entity`: it lives inside the diet aggregate, which carries the
 * timestamps. It has an `id` so it can be addressed and reordered.
 */
/**
 * What the quantity is measured in. `grams` never changes meaning — a
 * `unit` of `"ml"` is a display choice for a liquid, on the assumption that
 * 1 ml ≈ 1 g, not a second physical quantity. The catalogue has no
 * per-food density (or per-food portion weight — "1 ovo" needs one and the
 * TACO source this app draws from does not carry it), so this is the one
 * unit conversion that needs no food-specific data to be honest.
 */
export type MealItemUnit = "g" | "ml";

export interface MealItem {
  readonly id: EntityId;
  /** Where it came from. `null` once that catalogue entry is gone. */
  readonly foodId: EntityId | null;
  readonly name: string;
  readonly grams: number;
  readonly unit: MealItemUnit;
  readonly per100g: Macros;
}

export interface Meal {
  readonly id: EntityId;
  readonly name: string;
  /** `HH:MM`, or `null` when the meal has no fixed time. */
  readonly time: string | null;
  readonly notes: string;
  readonly items: readonly MealItem[];
}

/**
 * The aggregate root.
 *
 * Meals and items are stored inside the diet rather than in tables of their
 * own. The whole document is a few kilobytes, which makes reordering an array
 * move, makes every write atomic, and makes opening the editor a single read.
 */
/**
 * Anything that owns a list of meals.
 *
 * Two things do: a `Diet`, which is the plan, and a `FoodLog`, which is a day
 * that happened. Every meal operation in `edit-diet.ts` is written against
 * this rather than against `Diet`, which is why the log needed no second
 * editing layer and no second `MealCard`.
 */
export type MealOwner = Entity & { readonly meals: readonly Meal[] };

/**
 * Monday-first, unlike `Date#getDay()` — see `weekdayOf` in
 * `services/diet-schedule.ts` for the conversion. The week starting on
 * Monday is the convention `formatLongDay` and every date picker in the app
 * already renders in pt-BR.
 */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface Diet extends Entity {
  readonly name: string;
  readonly meals: readonly Meal[];
  /**
   * The days of the week this diet is the plan for. Empty means "not
   * scheduled" — the diet still exists and can be started manually from the
   * Diário, it just has no day that suggests it on its own.
   */
  readonly weekdays: readonly Weekday[];
}
