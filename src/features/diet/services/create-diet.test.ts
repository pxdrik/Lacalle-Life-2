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

  it("copies brand and the four optional nutrients (RM02) the same way", () => {
    const item = createMealItem({
      foodId: "iogurte-marca",
      name: "Iogurte",
      grams: 100,
      per100g: PER_100G,
      brand: "Marca X",
      saturatedFatG: 1.5,
      sodiumMg: 45,
      fiberG: 0,
      sugarG: 12,
    });

    expect(item).toMatchObject({
      brand: "Marca X",
      saturatedFatG: 1.5,
      sodiumMg: 45,
      fiberG: 0,
      sugarG: 12,
    });
  });

  it("leaves the four optional nutrients undefined, not zero, when the food has none on file", () => {
    const item = createMealItem({
      foodId: "salmao",
      name: "Salmão",
      grams: 100,
      per100g: PER_100G,
    });

    expect(item.brand).toBeUndefined();
    expect(item.saturatedFatG).toBeUndefined();
    expect(item.sodiumMg).toBeUndefined();
    expect(item.fiberG).toBeUndefined();
    expect(item.sugarG).toBeUndefined();
  });
});
