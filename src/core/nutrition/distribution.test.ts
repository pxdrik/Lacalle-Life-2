import { describe, expect, it } from "vitest";

import { KCAL_PER_GRAM, MACRO_SPLIT_PRESETS } from "./constants";
import { buildNutritionPlan } from "./plan";
import {
  macroSplitSchema,
  nutritionProfileSchema,
  type NutritionProfile,
} from "./profile";

const BASE: NutritionProfile = {
  sex: "male",
  ageYears: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
};

const profile = (overrides: Partial<NutritionProfile>): NutritionProfile => ({
  ...BASE,
  ...overrides,
});

/** Unwraps a plan, failing loudly rather than silently skipping the test. */
function plan(input: NutritionProfile) {
  const result = buildNutritionPlan(input);
  if (!result.ok) {
    throw new Error(
      `Perfil legítimo recusado: ${JSON.stringify(input)} — ${result.violations
        .map((v) => v.code)
        .join(", ")}`,
    );
  }
  return result.plan;
}

describe("MACRO_SPLIT_PRESETS", () => {
  it.each(MACRO_SPLIT_PRESETS.map((preset) => [preset.label, preset] as const))(
    "%s sums to 100",
    (_label, preset) => {
      expect(
        preset.carbsPercent + preset.proteinPercent + preset.fatPercent,
      ).toBe(100);
    },
  );
});

describe("computeDistribution — percentage split", () => {
  it("allocates grams from the chosen percentages instead of the priority algorithm", () => {
    const p = plan(
      profile({
        macroSplit: { proteinPercent: 40, carbsPercent: 30, fatPercent: 30 },
      }),
    );

    const proteinShare =
      (p.targets.proteinG * KCAL_PER_GRAM.protein) / p.targets.kcal;
    expect(proteinShare).toBeCloseTo(0.4, 1);
  });

  it("still refuses an infeasible split, the same safety gate the automatic path uses", () => {
    // 5% carbs on a small, sedentary cut collapses well under the 50 g
    // absolute floor. `findViolations` checks the resulting grams, not how
    // they were produced, so this trips the same violation an infeasible
    // automatic split would.
    const result = buildNutritionPlan(
      profile({
        sex: "female",
        weightKg: 45,
        heightCm: 150,
        ageYears: 45,
        activityLevel: "sedentary",
        goal: "cut",
        weeklyChangeKg: 2,
        macroSplit: { proteinPercent: 30, carbsPercent: 5, fatPercent: 65 },
      }),
    );

    expect(result.ok).toBe(false);
  });

  it("keeps macros within the same energy tolerance the automatic path is held to", () => {
    const p = plan(
      profile({
        macroSplit: { proteinPercent: 25, carbsPercent: 50, fatPercent: 25 },
      }),
    );
    const macroKcal =
      p.targets.proteinG * KCAL_PER_GRAM.protein +
      p.targets.carbsG * KCAL_PER_GRAM.carbs +
      p.targets.fatG * KCAL_PER_GRAM.fat;
    const tolerance = Math.max(p.targets.kcal * 0.02, 25);

    expect(Math.abs(macroKcal - p.targets.kcal)).toBeLessThanOrEqual(tolerance);
  });
});

describe("macroSplitSchema", () => {
  it("accepts percentages that sum to 100", () => {
    expect(
      macroSplitSchema.safeParse({
        proteinPercent: 25,
        carbsPercent: 50,
        fatPercent: 25,
      }).success,
    ).toBe(true);
  });

  it("rejects percentages that do not sum to 100", () => {
    expect(
      macroSplitSchema.safeParse({
        proteinPercent: 25,
        carbsPercent: 50,
        fatPercent: 30,
      }).success,
    ).toBe(false);
  });

  it("is optional on the profile — absent means automatic", () => {
    expect(nutritionProfileSchema.safeParse(BASE).success).toBe(true);
    expect(
      nutritionProfileSchema.safeParse({
        ...BASE,
        macroSplit: { proteinPercent: 25, carbsPercent: 50, fatPercent: 25 },
      }).success,
    ).toBe(true);
  });
});
