import { MAX_WEEKLY_GAIN_RATIO, MAX_WEEKLY_LOSS_RATIO } from "./constants";
import type { NutritionProfile } from "./profile";
import { round } from "./result";

export interface RatePreset {
  readonly id: "light" | "moderate";
  readonly label: string;
  readonly weeklyChangeKg: number;
}

/**
 * Weekly-rate presets for a cut or a bulk, derived from the same percentage
 * limits the engine already enforces (`MAX_WEEKLY_LOSS_RATIO`,
 * `MAX_WEEKLY_GAIN_RATIO`) rather than fixed kilograms.
 *
 * Fixed presets ("0,25 / 0,5 / 0,75 / 1 kg/semana") were the original ask, and
 * they cannot work: the safe ceiling is a **percentage of bodyweight**, and it
 * is asymmetric between losing and gaining. For a 60&nbsp;kg person the cut
 * ceiling is 0,6&nbsp;kg/semana — "1&nbsp;kg/semana" would already be unsafe —
 * and the bulk ceiling is 0,3&nbsp;kg/semana, where even "0,5" overshoots.
 * A preset computed per person is the only version that cannot silently
 * exceed the limit it is supposed to represent.
 *
 * Two tiers, not the requested four: "moderate" sits at the safe ceiling
 * itself, and a third tier between "light" and it would be a distinction
 * without a difference at typical bodyweights, where the gap can be a few
 * hundred grams. `weeklyChangeKg` still accepts a free value for anyone who
 * wants something in between or outside these two.
 */
export function weeklyRatePresets(
  weightKg: number,
  goal: Exclude<NutritionProfile["goal"], "maintain">,
): readonly RatePreset[] {
  const maxRatio = goal === "cut" ? MAX_WEEKLY_LOSS_RATIO : MAX_WEEKLY_GAIN_RATIO;
  const maxKg = weightKg * maxRatio;

  return [
    { id: "light", label: "Leve", weeklyChangeKg: round(maxKg * 0.5, 2) },
    { id: "moderate", label: "Moderado", weeklyChangeKg: round(maxKg, 2) },
  ];
}
