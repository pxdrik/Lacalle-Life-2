import type { Macros } from "@/core/domain/macros";

import {
  CARB_G_ABSOLUTE_MIN,
  FAT_G_PER_KG_MIN,
  FAT_KCAL_RATIO_DEFAULT,
  FAT_KCAL_RATIO_MIN,
  KCAL_PER_GRAM,
  PROTEIN_G_PER_KG,
} from "./constants";
import type { NutritionProfile } from "./profile";
import { round } from "./result";

export interface Distribution {
  readonly targets: Macros;
}

/**
 * Allocates macros in priority order: protein first (it preserves lean mass),
 * then fat (hormonal and essential-fatty-acid needs), then carbohydrate as
 * training fuel.
 *
 * The preferred amounts are a starting point, not an answer. Because protein
 * scales with total bodyweight, a heavy user on a deficit can see the
 * carbohydrate remainder collapse below its floor. Rather than refuse such a
 * profile, energy is reclaimed from protein first — down to the 0.8 g/kg
 * minimum — and then from fat, down to its own floor, until carbohydrate
 * clears.
 *
 * Only a target too small to hold all three minimums stays infeasible, and
 * that case is caught by the safety gate rather than silently emitted.
 */
export function computeDistribution(
  profile: NutritionProfile,
  targetKcal: number,
): Distribution {
  const { weightKg, goal } = profile;

  const proteinMinG = weightKg * PROTEIN_G_PER_KG.min;
  const fatFloorG = Math.max(
    weightKg * FAT_G_PER_KG_MIN,
    (targetKcal * FAT_KCAL_RATIO_MIN) / KCAL_PER_GRAM.fat,
  );
  const carbsFloorKcal = CARB_G_ABSOLUTE_MIN * KCAL_PER_GRAM.carbs;

  let proteinG = weightKg * PROTEIN_G_PER_KG[goal];
  let fatG = Math.max(
    (targetKcal * FAT_KCAL_RATIO_DEFAULT) / KCAL_PER_GRAM.fat,
    fatFloorG,
  );

  const remainingKcal = () =>
    targetKcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;

  // Reclaim from protein first: the preferred figure is generous, and 0.8 g/kg
  // is the point below which lean mass is at risk.
  let shortfallKcal = carbsFloorKcal - remainingKcal();
  if (shortfallKcal > 0) {
    const reclaimableG = Math.max(proteinG - proteinMinG, 0);
    proteinG -= Math.min(reclaimableG, shortfallKcal / KCAL_PER_GRAM.protein);
  }

  // Then from fat, never below its floor.
  shortfallKcal = carbsFloorKcal - remainingKcal();
  if (shortfallKcal > 0) {
    const reclaimableG = Math.max(fatG - fatFloorG, 0);
    fatG -= Math.min(reclaimableG, shortfallKcal / KCAL_PER_GRAM.fat);
  }

  const roundedProteinG = round(proteinG);
  const roundedFatG = round(fatG);
  const carbsKcal =
    targetKcal -
    roundedProteinG * KCAL_PER_GRAM.protein -
    roundedFatG * KCAL_PER_GRAM.fat;

  return {
    targets: {
      kcal: targetKcal,
      proteinG: roundedProteinG,
      carbsG: round(Math.max(carbsKcal / KCAL_PER_GRAM.carbs, 0)),
      fatG: roundedFatG,
    },
  };
}
