import { computeDistribution } from "./distribution";
import { computeBmr, computeEnergyTarget, computeTdee } from "./energy";
import type { NutritionProfile } from "./profile";
import type { PlanResult } from "./result";
import { findViolations } from "./safety";

/**
 * Builds a complete, safety-checked nutrition plan.
 *
 * This is the only supported way to obtain a calorie or macro target. Nothing
 * else in the application computes BMR, TDEE or a macro split — a second
 * implementation is how a product ends up with a README, a module and a test
 * that each claim a different formula.
 *
 * Assumes `profile` has already been parsed by `nutritionProfileSchema`.
 */
export function buildNutritionPlan(profile: NutritionProfile): PlanResult {
  const bmrKcal = computeBmr(profile);
  const tdeeKcal = computeTdee(profile, bmrKcal);

  const energy = computeEnergyTarget(profile, tdeeKcal, bmrKcal);
  const { targets, fiberG } = computeDistribution(profile, energy.targetKcal);

  const violations = findViolations(profile, targets, bmrKcal);
  if (violations.length > 0) return { ok: false, violations };

  return {
    ok: true,
    plan: {
      bmrKcal,
      tdeeKcal,
      targets,
      fiberG,
      energyBalanceKcal: energy.energyBalanceKcal,
      projectedWeeklyChangeKg: energy.projectedWeeklyChangeKg,
      advisories: energy.advisories,
    },
  };
}
