import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_KCAL_FLOOR,
  CARB_G_ABSOLUTE_MIN,
  KCAL_PER_GRAM,
  PROTEIN_G_PER_KG,
} from "./constants";
import { computeDistribution } from "./distribution";
import { computeBmr, computeTdee } from "./energy";
import { buildNutritionPlan } from "./plan";
import { nutritionProfileSchema, type NutritionProfile } from "./profile";

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

const macroKcal = (m: { proteinG: number; carbsG: number; fatG: number }) =>
  m.proteinG * KCAL_PER_GRAM.protein +
  m.carbsG * KCAL_PER_GRAM.carbs +
  m.fatG * KCAL_PER_GRAM.fat;

describe("computeBmr", () => {
  it("uses Mifflin-St Jeor for men", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(computeBmr(BASE)).toBe(1780);
  });

  it("uses Mifflin-St Jeor for women", () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 1370.25
    expect(
      computeBmr(profile({ sex: "female", weightKg: 65, heightCm: 165 })),
    ).toBeCloseTo(1370.25, 1);
  });

  it("switches to Katch-McArdle when body fat is known", () => {
    // Lean mass 80*(1-0.15) = 68 kg -> 370 + 21.6*68 = 1838.8
    expect(computeBmr(profile({ bodyFatPercent: 15 }))).toBeCloseTo(1838.8, 1);
  });

  it("gives a lower BMR at higher body fat for the same weight", () => {
    expect(computeBmr(profile({ bodyFatPercent: 35 }))).toBeLessThan(
      computeBmr(profile({ bodyFatPercent: 10 })),
    );
  });
});

describe("computeTdee", () => {
  it("applies the activity multiplier", () => {
    const bmr = computeBmr(BASE);

    expect(
      computeTdee(profile({ activityLevel: "sedentary" }), bmr),
    ).toBeCloseTo(bmr * 1.2, 1);
    expect(computeTdee(profile({ activityLevel: "athlete" }), bmr)).toBeCloseTo(
      bmr * 1.9,
      1,
    );
  });

  it("increases monotonically with activity", () => {
    const bmr = computeBmr(BASE);
    const values = (
      ["sedentary", "light", "moderate", "active", "athlete"] as const
    ).map((activityLevel) => computeTdee(profile({ activityLevel }), bmr));

    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe("energy target", () => {
  it("targets TDEE exactly when maintaining", () => {
    const p = plan(profile({ goal: "maintain" }));

    expect(p.targets.kcal).toBe(Math.round(p.tdeeKcal));
    expect(p.energyBalanceKcal).toBe(0);
  });

  it("caps the deficit at 25% of TDEE", () => {
    const p = plan(profile({ goal: "cut", weeklyChangeKg: 2 }));

    // Targets are whole kilocalories, so the realised ratio can sit up to
    // 1 kcal past the exact cap. Allow for that, nothing more.
    const slack = 1 / p.tdeeKcal;
    expect(Math.abs(p.energyBalanceKcal) / p.tdeeKcal).toBeLessThanOrEqual(
      0.25 + slack,
    );
    expect(p.energyBalanceKcal).toBeLessThan(0);
  });

  it("caps the surplus at 20% of TDEE", () => {
    const p = plan(profile({ goal: "bulk", weeklyChangeKg: 2 }));

    const slack = 1 / p.tdeeKcal;
    expect(p.energyBalanceKcal / p.tdeeKcal).toBeLessThanOrEqual(0.2 + slack);
    expect(p.energyBalanceKcal).toBeGreaterThan(0);
  });

  it("says when it clamped an unsustainable rate, rather than adjusting silently", () => {
    const p = plan(profile({ goal: "cut", weeklyChangeKg: 2 }));

    expect(p.advisories.map((a) => a.code)).toContain("WEEKLY_RATE_CLAMPED");
    expect(p.advisories[0]?.message).toMatch(/kg por semana/);
  });

  it("never returns a target below resting expenditure", () => {
    const p = plan(
      profile({ goal: "cut", weeklyChangeKg: 2, activityLevel: "sedentary" }),
    );

    expect(p.targets.kcal).toBeGreaterThanOrEqual(p.bmrKcal * 0.95);
  });
});

describe("safety floors", () => {
  it("keeps a small woman on an aggressive cut above the clinical floor", () => {
    const p = plan(
      profile({
        sex: "female",
        weightKg: 45,
        heightCm: 152,
        ageYears: 45,
        activityLevel: "sedentary",
        goal: "cut",
        weeklyChangeKg: 2,
      }),
    );

    expect(p.targets.kcal).toBeGreaterThanOrEqual(ABSOLUTE_KCAL_FLOOR.female);
  });

  it("never produces zero or near-zero carbohydrate", () => {
    const cases: NutritionProfile[] = [
      profile({ goal: "cut", weeklyChangeKg: 2 }),
      profile({ sex: "female", weightKg: 45, heightCm: 150, goal: "cut" }),
      // The case that exposed the original allocation bug: a heavy user
      // cutting, where protein at 2.2 g/kg crowded carbohydrate below its floor.
      profile({ weightKg: 150, heightCm: 178, goal: "cut", weeklyChangeKg: 2 }),
      profile({
        weightKg: 180,
        heightCm: 185,
        goal: "cut",
        activityLevel: "sedentary",
      }),
    ];

    for (const input of cases) {
      expect(plan(input).targets.carbsG).toBeGreaterThanOrEqual(
        CARB_G_ABSOLUTE_MIN,
      );
    }
  });

  it("holds protein under the absolute safe ceiling at every weight", () => {
    for (const weightKg of [45, 60, 80, 120, 150, 180]) {
      expect(
        plan(profile({ weightKg, goal: "cut" })).targets.proteinG,
      ).toBeLessThanOrEqual(weightKg * PROTEIN_G_PER_KG.absoluteMax);
    }
  });

  it("never drops protein below the 0.8 g/kg minimum", () => {
    const p = plan(
      profile({
        weightKg: 180,
        heightCm: 185,
        goal: "cut",
        activityLevel: "sedentary",
      }),
    );

    expect(p.targets.proteinG).toBeGreaterThanOrEqual(
      Math.floor(180 * PROTEIN_G_PER_KG.min),
    );
  });
});

describe("macro consistency", () => {
  it("keeps macros within 2% of the stated energy target", () => {
    for (const weightKg of [45, 60, 80, 100, 150]) {
      for (const goal of ["cut", "maintain", "bulk"] as const) {
        const p = plan(profile({ weightKg, goal }));
        const tolerance = Math.max(p.targets.kcal * 0.02, 25);

        expect(
          Math.abs(macroKcal(p.targets) - p.targets.kcal),
          `${weightKg} kg / ${goal}`,
        ).toBeLessThanOrEqual(tolerance);
      }
    }
  });

  it("reports the energy target as the targets' own kcal", () => {
    // The plan's targets are a `Macros`, so comparing them against a diet's
    // totals is a field-by-field read rather than a conversion.
    const p = plan(profile({ goal: "cut" }));

    expect(p.targets.kcal).toBeGreaterThan(0);
    expect(Object.keys(p.targets).sort()).toEqual([
      "carbsG",
      "fatG",
      "kcal",
      "proteinG",
    ]);
  });

  it("scales fibre with energy intake", () => {
    expect(computeDistribution(BASE, 3200).fiberG).toBeGreaterThan(
      computeDistribution(BASE, 1600).fiberG,
    );
  });
});

describe("input validation", () => {
  it.each([
    ["idade infantil", { ageYears: 8 }],
    ["idade fracionária", { ageYears: 30.5 }],
    ["altura implausível", { heightCm: 40 }],
    ["peso implausível", { weightKg: 500 }],
    ["percentual de gordura impossível", { bodyFatPercent: 90 }],
  ])("rejects %s", (_label, override) => {
    expect(
      nutritionProfileSchema.safeParse({ ...BASE, ...override }).success,
    ).toBe(false);
  });

  it.each([
    ["objetivo", { goal: "recomp" }],
    ["nível de atividade", { activityLevel: "extreme" }],
    ["sexo", { sex: "other" }],
  ])("rejects an unknown %s", (_label, override) => {
    expect(
      nutritionProfileSchema.safeParse({ ...BASE, ...override }).success,
    ).toBe(false);
  });

  it("accepts a valid profile", () => {
    expect(nutritionProfileSchema.safeParse(BASE).success).toBe(true);
  });
});
