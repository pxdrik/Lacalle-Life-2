import type { Macros } from "@/core/domain/macros";

import {
  ABSOLUTE_KCAL_FLOOR,
  BMR_FLOOR_TOLERANCE,
  CARB_G_ABSOLUTE_MIN,
  FAT_G_PER_KG_MIN,
  FAT_KCAL_RATIO_MIN,
  KCAL_PER_GRAM,
  PROTEIN_G_PER_KG,
} from "./constants";
import type { NutritionProfile } from "./profile";
import { round, type Violation } from "./result";

/**
 * The final gate. Anything that reaches here and fails is a plan we refuse to
 * emit — the caller gets violations instead of numbers to act on.
 *
 * Every check duplicates a clamp applied earlier. That is deliberate: the
 * clamps are the intent, this is the proof. A bug in the allocation that
 * produced an unsafe split would slip past the clamps and be caught here.
 */
export function findViolations(
  profile: NutritionProfile,
  targets: Macros,
  bmrKcal: number,
): readonly Violation[] {
  const violations: Violation[] = [];
  const targetKcal = targets.kcal;
  const absoluteFloor = ABSOLUTE_KCAL_FLOOR[profile.sex];

  if (targetKcal < absoluteFloor) {
    violations.push({
      code: "BELOW_ABSOLUTE_FLOOR",
      message:
        `Meta de ${targetKcal} kcal está abaixo do mínimo seguro de ` +
        `${absoluteFloor} kcal por dia sem acompanhamento clínico.`,
    });
  }

  if (targetKcal < round(bmrKcal * BMR_FLOOR_TOLERANCE)) {
    violations.push({
      code: "BELOW_RESTING_EXPENDITURE",
      message:
        `Meta de ${targetKcal} kcal está abaixo do gasto de repouso ` +
        `(TMB ${round(bmrKcal)} kcal).`,
    });
  }

  const proteinCeilingG = profile.weightKg * PROTEIN_G_PER_KG.absoluteMax;
  if (targets.proteinG > proteinCeilingG) {
    violations.push({
      code: "PROTEIN_EXCEEDS_SAFE_MAX",
      message:
        `Proteína de ${targets.proteinG} g excede o máximo seguro de ` +
        `${round(proteinCeilingG)} g (${PROTEIN_G_PER_KG.absoluteMax} g/kg).`,
    });
  }

  if (targets.carbsG < CARB_G_ABSOLUTE_MIN) {
    violations.push({
      code: "CARBS_BELOW_FLOOR",
      message:
        `Carboidrato de ${targets.carbsG} g está abaixo do mínimo de ` +
        `${CARB_G_ABSOLUTE_MIN} g. Metas com carboidrato zerado não são permitidas.`,
    });
  }

  const fatFloorG = Math.max(
    profile.weightKg * FAT_G_PER_KG_MIN,
    (targetKcal * FAT_KCAL_RATIO_MIN) / KCAL_PER_GRAM.fat,
  );
  if (targets.fatG < Math.floor(fatFloorG)) {
    violations.push({
      code: "FAT_BELOW_FLOOR",
      message:
        `Gordura de ${targets.fatG} g está abaixo do mínimo de ` +
        `${round(fatFloorG)} g necessário para função hormonal.`,
    });
  }

  // The parts must add up to the headline. Guards against a bug shipping a
  // plan whose macros contradict its own calorie target.
  const macroKcal =
    targets.proteinG * KCAL_PER_GRAM.protein +
    targets.carbsG * KCAL_PER_GRAM.carbs +
    targets.fatG * KCAL_PER_GRAM.fat;

  const tolerance = Math.max(targetKcal * 0.02, 25);
  if (Math.abs(macroKcal - targetKcal) > tolerance) {
    violations.push({
      code: "MACROS_INCONSISTENT_WITH_ENERGY",
      message:
        `Macros somam ${round(macroKcal)} kcal, inconsistente com a meta de ` +
        `${targetKcal} kcal (tolerância ${round(tolerance)} kcal).`,
    });
  }

  return violations;
}
