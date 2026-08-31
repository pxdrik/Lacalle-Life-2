import type { Entity, EntityId } from "@/core/domain/entity";
import type { Macros } from "@/core/domain/macros";
import type { PracticalUnit } from "@/features/foods";

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
 * 1 ml ≈ 1 g, not a second physical quantity. A food's `practicalUnit` (a
 * household measure like "1 fatia média") is a separate, optional thing:
 * it only ever offers a second way to *enter* a quantity, converted to grams
 * at input time — it is never a third value here, so a row without one
 * behaves exactly as it always has.
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
  /**
   * Copied from the food at add time, same as `per100g` and for the same
   * reason: the catalogue's measure can change or disappear later without
   * rewriting a plan the user already built around it. `undefined` when the
   * food had none, or was custom, or predates this field.
   */
  readonly practicalUnit?: PracticalUnit | undefined;
}

export interface Meal {
  readonly id: EntityId;
  readonly name: string;
  /** `HH:MM`, or `null` when the meal has no fixed time. */
  readonly time: string | null;
  readonly notes: string;
  readonly items: readonly MealItem[];
  /**
   * Which diet, and which meal in it, this one is a snapshot of.
   *
   * Only ever set on a meal living inside a `FoodLog` — a `Diet`'s own meals
   * never carry this. It is what lets "Comi esta refeição" on the diet
   * screen recognise a meal it already checked today instead of adding a
   * second copy, and what `startDayFromDiet` stamps on every meal it copies
   * so starting a whole day shows each of its meals as already checked. Both
   * fields travel together and are only ever read together — see
   * `services/meal-execution.ts`.
   */
  readonly sourceDietId?: EntityId | undefined;
  readonly sourceMealId?: EntityId | undefined;
  /**
   * `items`, frozen the moment this meal was checked or the day was
   * started. Only ever set alongside `sourceDietId`/`sourceMealId`, and
   * never touched again by anything after that.
   *
   * It is what lets the diet screen tell "comido como planejado" apart from
   * "comido, mas depois editado" without a second flag to keep in sync: the
   * two are the same question — does `items` still equal this? — asked at
   * read time. See `mealCheckState` in `services/meal-execution.ts`.
   */
  readonly plannedSnapshot?: readonly MealItem[] | undefined;
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
