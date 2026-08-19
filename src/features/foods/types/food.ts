import type { Entity } from "@/core/domain/entity";
import type { Macros } from "@/core/domain/macros";

export const FOOD_CATEGORIES = [
  "protein",
  "carb",
  "fat",
  "dairy",
  "vegetable",
  "fruit",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/**
 * A runtime array, unlike most of the unions here, because the category filter
 * renders one chip per category and the schema validates against the same list.
 */
export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  protein: "Proteínas",
  carb: "Carboidratos",
  fat: "Gorduras",
  dairy: "Laticínios",
  vegetable: "Vegetais",
  fruit: "Frutas",
};

export interface Food extends Entity {
  readonly name: string;
  readonly category: FoodCategory;
  /** Nutrition per 100 g — the unit the whole catalogue is normalised to. */
  readonly per100g: Macros;
  /**
   * Catalogue entries are `false`; foods the user created are `true`.
   *
   * They live in the same store on purpose: search, favourites and a future
   * CSV import should not care where a food came from.
   */
  readonly isCustom: boolean;

  /**
   * Marked by the user. Only custom foods can be deleted, but anything can be
   * favourited — which is how someone makes a 581-row catalogue feel like the
   * fifteen things they actually eat.
   */
  readonly isFavorite: boolean;
}
