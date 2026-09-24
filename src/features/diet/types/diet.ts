import type { Entity, EntityId } from "@/core/domain/entity";
import type { Macros } from "@/core/domain/macros";
import type { FoodUnit, PracticalUnit } from "@/features/foods";

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
 * 1 ml ≈ 1 g, not a second physical quantity. Copied from the food's own
 * `FoodUnit` at add time (same as `per100g`) and never edited per item —
 * a food's measurement kind is a property of the food, not a choice made
 * meal by meal. A food's `practicalUnit` (a household measure like "1 fatia
 * média") is a separate, optional thing: it only ever offers a second way to
 * *enter* a quantity, converted to grams at input time — it is never a third
 * value here, so a row without one behaves exactly as it always has.
 */
export type MealItemUnit = FoodUnit;

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
  /**
   * Copied from `Food.brand`/`Food.saturatedFatG`/etc. at add time, same
   * reason as `practicalUnit` above — and independently editable afterwards
   * from the item's own detail page (RM02, roadmap 23/09/2026), since these
   * are exactly the fields a food's own catalogue entry realistically never
   * has: the person looks at the actual package in front of them and fills
   * in what the catalogue could not know in advance. `undefined` means "not
   * informed", never a silent zero — see `Food.saturatedFatG` for why that
   * distinction matters here.
   */
  readonly brand?: string | undefined;
  readonly saturatedFatG?: number | undefined;
  readonly sodiumMg?: number | undefined;
  readonly fiberG?: number | undefined;
  readonly sugarG?: number | undefined;
}

/**
 * One other way to eat a meal — a marmita's rice version beside its pasta
 * version, saved so switching between them is a pick instead of re-adding
 * every food by hand.
 *
 * Deliberately not kept in sync with the meal's live `items`: saving one is
 * an explicit act (`saveMealAsAlternative`), same as everything else in this
 * file that could instead have tried to be clever about it. Editing a
 * portion on the meal never rewrites a saved alternative nobody asked to
 * change, for the same reason `MealItem.per100g` is a copy rather than a
 * lookup.
 */
export interface MealAlternative {
  readonly id: EntityId;
  readonly name: string;
  readonly items: readonly MealItem[];
}

export interface Meal {
  readonly id: EntityId;
  readonly name: string;
  /** `HH:MM`, or `null` when the meal has no fixed time. */
  readonly time: string | null;
  readonly notes: string;
  readonly items: readonly MealItem[];
  /**
   * Other suggestions for this meal, not counting whichever is currently
   * live in `items` above. `undefined` — never `[]` — until the first one is
   * saved, same convention as `sourceDietId`/`plannedSnapshot` below: a
   * meal that predates this field has no key for it at all.
   */
  readonly alternatives?: readonly MealAlternative[] | undefined;
  /**
   * Whether this meal has actually been eaten. Only ever meaningful on a
   * meal living inside a `FoodLog` that also carries `sourceDietId`/
   * `sourceMealId` — see there.
   *
   * `false`, never absence, is what marks a meal *not* eaten yet: every
   * meal a `FoodLog` predating this field carries was, by the rule that
   * came before it, already eaten (presence in `meals` used to be the only
   * signal). Reading `undefined` as eaten keeps every already-recorded day
   * reading exactly as it did before this field existed — see
   * `isMealEaten` in `services/meal-execution.ts`, the one place allowed to
   * read this field directly instead of everyone re-deriving the same
   * "undefined means legacy-true" rule.
   */
  readonly eaten?: boolean | undefined;
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
  /**
   * Where this meal sits among its owner's other meals — set once, when it
   * enters the list (creation, duplication, a diet check/open into a
   * `FoodLog`), and touched again only by an explicit move
   * (`moveMeal`/`reorderMeals` in `edit-diet.ts`). `undefined` predates this
   * field; array position is the fallback until the next mutation stamps it
   * (see `mergeFoodLogMeals` in `composition/sync/food-log-merge.ts`).
   *
   * Only `FoodLog.meals` actually needs this: it is unioned by id across
   * devices during sync (§19.5), and array position alone does not survive
   * that union — two devices merging the same set would each see their own
   * local order as "the" order and never agree. A `Diet`'s own meals never
   * go through that merge (a diet syncs as one whole document, §19.5), so
   * this field is simply unused there — kept on the shared `Meal` type
   * anyway rather than split, since `edit-diet.ts` already runs the same
   * operations against both.
   */
  readonly order?: number | undefined;
  /**
   * The items this meal had right before "transformar em 1 alimento"
   * (`useConsolidateMeal`, roadmap 23/09/2026) replaced them with a single
   * item referencing the new catalogue food. `undefined` — same convention
   * as `plannedSnapshot` above — until that first happens, and cleared back
   * to `undefined` by the undo, so its presence alone is what the ⋮ menu
   * checks to decide whether "Desfazer transformação" has anything to
   * restore, independent of whichever toast fired at the time.
   */
  readonly consolidatedFrom?: readonly MealItem[] | undefined;
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
