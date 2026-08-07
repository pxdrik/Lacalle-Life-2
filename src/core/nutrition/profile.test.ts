import { describe, expect, it } from "vitest";

import { nutritionProfileSchema } from "./profile";

const VALID = {
  sex: "male",
  ageYears: 32,
  heightCm: 178,
  weightKg: 81,
  activityLevel: "moderate",
  goal: "cut",
} as const;

describe("nutritionProfileSchema", () => {
  it("accepts a filled profile", () => {
    expect(nutritionProfileSchema.safeParse(VALID).success).toBe(true);
  });

  it("answers in Portuguese for every blank number", () => {
    // The form sends `NaN` for a blank field. Without a message of our own,
    // Zod answers "Invalid input: expected number, received NaN" — library
    // text, in English, on the screen that decides somebody's calorie target.
    const result = nutritionProfileSchema.safeParse({
      ...VALID,
      ageYears: Number.NaN,
      heightCm: Number.NaN,
      weightKg: Number.NaN,
      bodyFatPercent: Number.NaN,
      weeklyChangeKg: Number.NaN,
    });

    expect(result.success).toBe(false);
    for (const issue of result.error!.issues) {
      expect(issue.message, issue.path.join(".")).not.toMatch(/Invalid input/i);
      expect(issue.message, issue.path.join(".")).not.toMatch(/expected/i);
    }
  });

  it("answers in Portuguese for out-of-range numbers too", () => {
    const result = nutritionProfileSchema.safeParse({
      ...VALID,
      ageYears: 5,
      heightCm: 400,
      weightKg: 2,
      bodyFatPercent: 90,
      weeklyChangeKg: 99,
    });

    expect(result.success).toBe(false);
    for (const issue of result.error!.issues) {
      expect(issue.message, issue.path.join(".")).not.toMatch(
        /Too (small|big)|greater than|less than/i,
      );
    }
  });

  it("treats the optional fields as genuinely optional", () => {
    // The rule since the first commit: a diet works without any of this.
    expect(nutritionProfileSchema.safeParse(VALID).success).toBe(true);
  });
});
