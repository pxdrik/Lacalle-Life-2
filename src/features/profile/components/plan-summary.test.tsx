import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildNutritionPlan, type NutritionProfile } from "@/core/nutrition";

import { PlanSummary } from "./plan-summary";

/**
 * The adversarial scenario from the Sprint 4 validation: a profile that asks
 * to cut, where the safety floor on weekly rate pushes the calculated target
 * above maintenance. The engine is right to do this — the bug was that the
 * screen said "Superávit de 88 kcal" without ever mentioning the goal it
 * contradicted.
 */
const ADVERSARIAL_CUT: NutritionProfile = {
  sex: "female",
  ageYears: 60,
  heightCm: 150,
  weightKg: 45,
  activityLevel: "sedentary",
  goal: "cut",
  weeklyChangeKg: 1,
};

function unwrap(profile: NutritionProfile) {
  const result = buildNutritionPlan(profile);
  if (!result.ok) throw new Error("Perfil legítimo recusado no teste.");
  return result;
}

describe("PlanSummary", () => {
  it("flags a cut goal that landed in surplus, connecting the two", () => {
    const result = unwrap(ADVERSARIAL_CUT);
    expect(result.plan.energyBalanceKcal).toBeGreaterThan(0);

    render(<PlanSummary result={result} goal="cut" />);

    const notice = screen.getByText(/Seu objetivo era/).closest("p");
    expect(notice).toHaveTextContent("perder peso");
    expect(notice).toHaveTextContent("Superávit");
  });

  it("stays quiet about the goal when the result matches it", () => {
    const result = unwrap({
      sex: "male",
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: "moderate",
      goal: "maintain",
    });

    render(<PlanSummary result={result} goal="maintain" />);

    expect(screen.queryByText(/Seu objetivo era/)).not.toBeInTheDocument();
  });

  it("stays quiet for a cut that actually lands in deficit", () => {
    const result = unwrap({
      sex: "male",
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: "moderate",
      goal: "cut",
      weeklyChangeKg: 0.3,
    });
    expect(result.plan.energyBalanceKcal).toBeLessThan(0);

    render(<PlanSummary result={result} goal="cut" />);

    expect(screen.queryByText(/Seu objetivo era/)).not.toBeInTheDocument();
    expect(screen.getByText(/Déficit/)).toBeInTheDocument();
  });
});
