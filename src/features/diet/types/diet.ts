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
export interface MealItem {
  readonly id: EntityId;
  /** Where it came from. `null` once that catalogue entry is gone. */
  readonly foodId: EntityId | null;
  readonly name: string;
  readonly grams: number;
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
export interface Diet extends Entity {
  readonly name: string;
  readonly meals: readonly Meal[];
}
