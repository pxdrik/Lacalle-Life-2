import { describe, expect, it } from "vitest";

import { createMealItem } from "./create-diet";

/**
 * `practicalUnit` follows the exact same copy-not-lookup rule `per100g`
 * already follows — see the doc comment on `MealItem`. This only tests that
 * the copy actually happens (and does not happen when there is nothing to
 * copy); the rule itself is documented on the type.
 */
describe("createMealItem", () => {
  const PER_100G = { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 };

  it("copies the food's practical unit onto the item", () => {
    const item = createMealItem({
      foodId: "abacate",
      name: "Abacate",
      grams: 100,
      per100g: PER_100G,
      practicalUnit: { label: "1/2 unidade média", grams: 100 },
    });

    expect(item.practicalUnit).toEqual({
      label: "1/2 unidade média",
      grams: 100,
    });
  });

  it("leaves practicalUnit undefined when the food has none", () => {
    const item = createMealItem({
      foodId: "salmao",
      name: "Salmão",
      grams: 100,
      per100g: PER_100G,
    });

    expect(item.practicalUnit).toBeUndefined();
  });
});
