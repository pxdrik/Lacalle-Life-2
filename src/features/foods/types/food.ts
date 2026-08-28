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

/**
 * A named household measure for one food — "1 fatia média" is 80 g of
 * abacaxi. `undefined` on a `Food` means no source this catalogue draws from
 * (TBCA, TACO, USDA Food Buying Guide) had a weight confident enough to
 * publish, not that nobody has looked — grams/ml stays the only way to log
 * that food, exactly as before this field existed.
 */
export interface PracticalUnit {
  readonly label: string;
  readonly grams: number;
}

export interface Food extends Entity {
  readonly name: string;
  readonly category: FoodCategory;
  /** Nutrition per 100 g — the unit the whole catalogue is normalised to. */
  readonly per100g: Macros;
  /** The catalogue's household measure for this food, when one is known. */
  readonly practicalUnit?: PracticalUnit | undefined;
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
