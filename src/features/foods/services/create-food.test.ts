import { describe, expect, it } from "vitest";

import { customFoodSchema } from "../validation/food-schema";
import { createCustomFood, estimateKcal } from "./create-food";

const VALID = {
  name: "Whey protein",
  category: "protein",
  per100g: { kcal: 400, proteinG: 80, carbsG: 8, fatG: 7 },
} as const;

describe("createCustomFood", () => {
  it("marks the food as the user's own", () => {
    const food = createCustomFood(VALID);

    expect(food.isCustom).toBe(true);
    expect(food.isFavorite).toBe(false);
  });

  it("gives every food a distinct id", () => {
    const ids = new Set([
      createCustomFood(VALID).id,
      createCustomFood(VALID).id,
      createCustomFood(VALID).id,
    ]);

    expect(ids.size).toBe(3);
  });

  it("stamps createdAt and updatedAt identically", () => {
    const food = createCustomFood(VALID);

    expect(food.createdAt).toBeGreaterThan(0);
    expect(food.updatedAt).toBe(food.createdAt);
  });

  it("trims the name", () => {
    const food = createCustomFood({ ...VALID, name: "  Whey  " });

    expect(food.name).toBe("Whey");
  });
});

describe("estimateKcal", () => {
  it("applies Atwater factors", () => {
    expect(estimateKcal({ proteinG: 10, carbsG: 10, fatG: 10 })).toBe(170);
  });

  it("is zero for an empty food", () => {
    expect(estimateKcal({ proteinG: 0, carbsG: 0, fatG: 0 })).toBe(0);
  });

  it("overestimates a high-fibre food, which is why it is only a hint", () => {
    // Lemon: 29 kcal on the label, 43 by Atwater. The gap is fibre, at ~2 kcal
    // per gram rather than 4. This is the reason the form suggests instead of
    // filling in.
    expect(estimateKcal({ proteinG: 1.1, carbsG: 9, fatG: 0.3 })).toBeGreaterThan(29);
  });
});

describe("customFoodSchema", () => {
  it("accepts a valid food", () => {
    expect(customFoodSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a blank name", () => {
    const result = customFoodSchema.safeParse({ ...VALID, name: "   " });

    expect(result.success).toBe(false);
  });

  it("rejects macros that cannot fit in 100 g", () => {
    const result = customFoodSchema.safeParse({
      ...VALID,
      per100g: { kcal: 500, proteinG: 60, carbsG: 30, fatG: 30 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects energy above what pure fat could provide", () => {
    const result = customFoodSchema.safeParse({
      ...VALID,
      per100g: { kcal: 1200, proteinG: 0, carbsG: 0, fatG: 100 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing number rather than treating it as zero", () => {
    const result = customFoodSchema.safeParse({
      ...VALID,
      per100g: { kcal: Number.NaN, proteinG: 10, carbsG: 10, fatG: 10 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative values", () => {
    const result = customFoodSchema.safeParse({
      ...VALID,
      per100g: { kcal: 100, proteinG: -5, carbsG: 10, fatG: 10 },
    });

    expect(result.success).toBe(false);
  });
});
