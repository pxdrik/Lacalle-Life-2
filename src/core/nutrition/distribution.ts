import type { Macros } from "@/core/domain/macros";

import {
  CARB_G_ABSOLUTE_MIN,
  FAT_G_PER_KG_MIN,
  FAT_KCAL_RATIO_DEFAULT,
  FAT_KCAL_RATIO_MIN,
  KCAL_PER_GRAM,
  PROTEIN_G_PER_KG,
} from "./constants";
import type { MacroSplit, NutritionProfile } from "./profile";
import { round } from "./result";

export interface Distribution {
  readonly targets: Macros;
}

/**
 * Allocates macros either from a person-chosen percentage split, or —
 * absent one — in priority order: protein first (it preserves lean mass),
 * then fat (hormonal and essential-fatty-acid needs), then carbohydrate as
 * training fuel.
 *
 * Still the one function that decides a macro split, per the file comment on
 * `plan.ts`: `profile.macroSplit` is a second *input*, not a second
 * implementation. Either path hands its grams to the same safety gate
 * (`findViolations`) — a percentage split has no floors of its own, and an
 * infeasible one (e.g. a 5% carb preset under a low-calorie target) is
 * refused downstream exactly like an infeasible automatic split is.
 *
 * The preferred amounts of the automatic path are a starting point, not an
 * answer. Because protein scales with total bodyweight, a heavy user on a
 * deficit can see the carbohydrate remainder collapse below its floor.
 * Rather than refuse such a profile, energy is reclaimed from protein first
 * — down to the 0.8 g/kg minimum — and then from fat, down to its own floor,
 * until carbohydrate clears.
 *
 * Only a target too small to hold all three minimums stays infeasible, and
 * that case is caught by the safety gate rather than silently emitted.
 */
export function computeDistribution(
  profile: NutritionProfile,
  targetKcal: number,
): Distribution {
  if (profile.macroSplit) {
    return { targets: fromPercentSplit(profile.macroSplit, targetKcal) };
  }

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

/**
 * Grams straight from a percentage of `targetKcal` — no floors, no
 * reclaiming. Protein and fat round first, and carbohydrate takes the
 * remainder in kcal rather than its own rounded share, the same technique the
 * automatic path above uses: it is what keeps the three grams summing back to
 * `targetKcal` within `findViolations`'s tolerance instead of drifting off it
 * by a couple of kcal from independent rounding.
 */
function fromPercentSplit(split: MacroSplit, targetKcal: number): Macros {
  const proteinG = round(
    (targetKcal * split.proteinPercent) / 100 / KCAL_PER_GRAM.protein,
  );
  const fatG = round((targetKcal * split.fatPercent) / 100 / KCAL_PER_GRAM.fat);
  const carbsKcal =
    targetKcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;

  return {
    kcal: targetKcal,
    proteinG,
    carbsG: round(Math.max(carbsKcal / KCAL_PER_GRAM.carbs, 0)),
    fatG,
  };
}
