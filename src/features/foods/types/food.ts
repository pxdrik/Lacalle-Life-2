import type { Entity } from "@/core/domain/entity";
import type { Macros } from "@/core/domain/macros";

export const FOOD_CATEGORIES = [
  "protein",
  "carb",
  "fat",
  "dairy",
  "vegetable",
  "fruit",
  "beverage",
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
  beverage: "Bebidas",
};

/**
 * What a food is measured in — grams for anything solid, millilitres for
 * anything poured, on the assumption (already made throughout `features/diet`
 * — see `MealItemUnit`) that 1 ml ≈ 1 g. A property of the *food*, not a
 * per-meal choice: water is always `"ml"`, rice is always `"g"`, so a
 * `MealItem` copies this at add time instead of asking the person every time
 * they log it (17/09/2026, Pedro: liquids and solids should already come
 * "definidos", not re-picked per portion).
 */
export type FoodUnit = "g" | "ml";

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
  /**
   * Nutrition per 100 g — or per 100 ml, when `unit` is `"ml"`. The catalogue
   * field name predates liquids and still describes the great majority of
   * entries; it was not worth renaming everywhere `Macros` is read just to
   * keep one word accurate for the smaller half.
   */
  readonly per100g: Macros;
  /**
   * Grams or millilitres — see `FoodUnit`. Required going forward; a record
   * written before this field existed reads as `"g"` (`normalize()` in
   * `local-food-repository.ts`), same convention as `isFavorite`, since
   * every food in this catalogue was solid before liquids were added here.
   */
  readonly unit: FoodUnit;
  /** The catalogue's household measure for this food, when one is known. */
  readonly practicalUnit?: PracticalUnit | undefined;
  /**
   * A specific product's brand — "Nestlé", "Seara" — never inferred, only
   * ever what someone actually typed. `undefined` is the overwhelming
   * common case: the catalogue is generic (TBCA/TACO/USDA), not brand-name
   * products, so this is realistically only ever filled on a food a person
   * created themselves.
   */
  readonly brand?: string | undefined;
  /**
   * Per 100 g (or 100 ml, same basis as `per100g`) — RM02, roadmap
   * 23/09/2026. Deliberately not folded into `Macros`: that type drives
   * every total the app already sums and scales (`scaleMacros`,
   * `sumMacros`), and none of the four numbers below has ever been part of
   * that arithmetic — adding them there would mean touching every one of
   * those call sites for a field most foods will never have a value for.
   *
   * `undefined` means "not informed", never a silent zero — a food with no
   * fiber data on file must never read as "0 g of fiber", which would be a
   * fabricated fact, not an absence of one.
   */
  readonly saturatedFatG?: number | undefined;
  readonly sodiumMg?: number | undefined;
  readonly fiberG?: number | undefined;
  readonly sugarG?: number | undefined;
  /**
   * Catalogue entries are `false`; foods the user created are `true`.
   *
   * They live in the same store on purpose: search, favourites and a future
   * CSV import should not care where a food came from.
   */
  readonly isCustom: boolean;

  /**
   * Marked by the user. Only custom foods can be deleted, but anything can be
   * favourited — which is how someone makes a 580-row catalogue feel like the
   * fifteen things they actually eat.
   */
  readonly isFavorite: boolean;
}
