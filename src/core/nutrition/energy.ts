import {
  ABSOLUTE_KCAL_FLOOR,
  BMR_FLOOR_TOLERANCE,
  KCAL_PER_KG_BODY_MASS,
  MAX_DEFICIT_RATIO,
  MAX_SURPLUS_RATIO,
  MAX_WEEKLY_GAIN_RATIO,
  MAX_WEEKLY_LOSS_RATIO,
  ACTIVITY_MULTIPLIER,
} from "./constants";
import type { NutritionProfile } from "./profile";
import { round, type Advisory } from "./result";

/**
 * Resting energy expenditure.
 *
 * Katch-McArdle when body composition is known — it keys off lean mass and so
 * handles lean or heavily muscled bodies far better — otherwise Mifflin-St
 * Jeor, the most reliable general-population estimate.
 */
export function computeBmr(profile: NutritionProfile): number {
  const { weightKg, heightCm, ageYears, sex, bodyFatPercent } = profile;

  if (bodyFatPercent !== undefined) {
    const leanMassKg = weightKg * (1 - bodyFatPercent / 100);
    return round(370 + 21.6 * leanMassKg, 1);
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return round(sex === "male" ? base + 5 : base - 161, 1);
}

export function computeTdee(
  profile: NutritionProfile,
  bmrKcal: number,
): number {
  return round(bmrKcal * ACTIVITY_MULTIPLIER[profile.activityLevel], 1);
}

export interface EnergyTarget {
  readonly targetKcal: number;
  /** Signed: negative for a deficit, positive for a surplus. */
  readonly energyBalanceKcal: number;
  readonly projectedWeeklyChangeKg: number;
  readonly advisories: readonly Advisory[];
}

/**
 * Derives the daily energy target, clamping both the requested rate of change
 * and the resulting deficit or surplus to sustainable bounds.
 *
 * Clamping is reported through advisories rather than applied silently: the
 * user asked for something we adjusted, and they should be told.
 */
export function computeEnergyTarget(
  profile: NutritionProfile,
  tdeeKcal: number,
  bmrKcal: number,
): EnergyTarget {
  const advisories: Advisory[] = [];
  const { goal, weightKg } = profile;

  if (goal === "maintain") {
    return {
      targetKcal: round(tdeeKcal),
      energyBalanceKcal: 0,
      projectedWeeklyChangeKg: 0,
      advisories,
    };
  }

  const isCut = goal === "cut";
  const maxWeeklyRatio = isCut ? MAX_WEEKLY_LOSS_RATIO : MAX_WEEKLY_GAIN_RATIO;
  const maxWeeklyKg = weightKg * maxWeeklyRatio;

  const requestedWeeklyKg = profile.weeklyChangeKg ?? maxWeeklyKg * 0.75;
  let weeklyKg = requestedWeeklyKg;

  if (weeklyKg > maxWeeklyKg) {
    weeklyKg = maxWeeklyKg;
    advisories.push({
      code: "WEEKLY_RATE_CLAMPED",
      message:
        `Ritmo reduzido para ${round(maxWeeklyKg, 2)} kg por semana — o pedido de ` +
        `${round(requestedWeeklyKg, 2)} kg excede o limite sustentável de ` +
        `${round(maxWeeklyRatio * 100, 2)}% do peso corporal.`,
    });
  }

  const dailyDelta = (weeklyKg * KCAL_PER_KG_BODY_MASS) / 7;

  // Clamped as a share of TDEE, independently of the rate clamp above.
  const maxDelta = tdeeKcal * (isCut ? MAX_DEFICIT_RATIO : MAX_SURPLUS_RATIO);
  let appliedDelta = dailyDelta;

  if (appliedDelta > maxDelta) {
    appliedDelta = maxDelta;
    advisories.push({
      code: isCut ? "DEFICIT_CLAMPED" : "SURPLUS_CLAMPED",
      message:
        `${isCut ? "Déficit" : "Superávit"} limitado a ${round(maxDelta)} kcal ` +
        `(${round((isCut ? MAX_DEFICIT_RATIO : MAX_SURPLUS_RATIO) * 100)}% do TDEE).`,
    });
  }

  let targetKcal = round(tdeeKcal + (isCut ? -appliedDelta : appliedDelta));

  // Raised to the resting-expenditure floor when cutting.
  const bmrFloor = round(bmrKcal * BMR_FLOOR_TOLERANCE);
  if (isCut && targetKcal < bmrFloor) {
    targetKcal = bmrFloor;
    advisories.push({
      code: "TARGET_RAISED_TO_FLOOR",
      message:
        `Meta elevada para ${bmrFloor} kcal para não ficar abaixo do gasto de ` +
        `repouso (TMB ${round(bmrKcal)} kcal).`,
    });
  }

  // Raised to the absolute clinical floor.
  const absoluteFloor = ABSOLUTE_KCAL_FLOOR[profile.sex];
  if (targetKcal < absoluteFloor) {
    targetKcal = absoluteFloor;
    advisories.push({
      code: "TARGET_RAISED_TO_FLOOR",
      message: `Meta elevada para o mínimo seguro de ${absoluteFloor} kcal por dia.`,
    });
  }

  const energyBalanceKcal = round(targetKcal - tdeeKcal);

  return {
    targetKcal,
    energyBalanceKcal,
    projectedWeeklyChangeKg: round(
      (energyBalanceKcal * 7) / KCAL_PER_KG_BODY_MASS,
      3,
    ),
    advisories,
  };
}
