/**
 * Physiological constants and safety limits.
 *
 * These are guardrails, not preferences. The app computes calorie targets that
 * people act on, so every bound here exists to make an unsafe target
 * unrepresentable rather than merely discouraged.
 *
 * Sources are mainstream sports-nutrition and clinical practice:
 *  - Mifflin-St Jeor (1990) for resting energy expenditure
 *  - Katch-McArdle for lean-mass-based REE when body fat is known
 *  - Commonly cited clinical floors for unsupervised intake (1200/1500 kcal)
 *
 * This is not medical advice, and the UI says so wherever a target appears.
 */

export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/**
 * Absolute floors for unsupervised daily intake. Below these a plan is refused
 * outright rather than warned about.
 */
export const ABSOLUTE_KCAL_FLOOR = {
  female: 1200,
  male: 1500,
} as const;

/**
 * A sustained target must never sit below resting expenditure. The small
 * tolerance keeps a legitimately modest deficit from being rejected by
 * rounding alone.
 */
export const BMR_FLOOR_TOLERANCE = 0.95;

/** Largest defensible deficit and surplus, as a share of TDEE. */
export const MAX_DEFICIT_RATIO = 0.25;
export const MAX_SURPLUS_RATIO = 0.2;

/** Sustainable weekly bodyweight change, as a share of bodyweight. */
export const MAX_WEEKLY_LOSS_RATIO = 0.01;
export const MAX_WEEKLY_GAIN_RATIO = 0.005;

/** Energy equivalent of one kilogram of body mass. */
export const KCAL_PER_KG_BODY_MASS = 7700;

/**
 * Protein in grams per kilogram of bodyweight. `absoluteMax` is a hard safety
 * bound: above it a plan is refused, because it is neither useful nor safe.
 */
export const PROTEIN_G_PER_KG = {
  min: 0.8,
  cut: 2.2,
  maintain: 1.8,
  bulk: 1.8,
  absoluteMax: 3.5,
} as const;

/**
 * Dietary fat floor. Below roughly 0.5 g/kg — or 15% of energy — essential
 * fatty-acid intake and hormone production are compromised.
 */
export const FAT_G_PER_KG_MIN = 0.5;
export const FAT_KCAL_RATIO_MIN = 0.15;
export const FAT_KCAL_RATIO_DEFAULT = 0.25;

/**
 * Carbohydrate floor. Zero-carb targets are rejected: glycaemic and training
 * demands make them inappropriate for a general-purpose training app.
 */
export const CARB_G_ABSOLUTE_MIN = 50;

/** Fibre guidance, scaled per 1000 kcal. */
export const FIBER_G_PER_1000_KCAL = 14;

export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "athlete",
] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_MULTIPLIER: Readonly<Record<ActivityLevel, number>> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export const BIOLOGICAL_SEXES = ["female", "male"] as const;
export type BiologicalSex = (typeof BIOLOGICAL_SEXES)[number];

export const GOALS = ["cut", "maintain", "bulk"] as const;
export type Goal = (typeof GOALS)[number];

/** Plausibility bounds for user-entered anthropometrics. */
export const INPUT_BOUNDS = {
  ageYears: { min: 14, max: 100 },
  heightCm: { min: 120, max: 250 },
  weightKg: { min: 30, max: 300 },
  bodyFatPercent: { min: 3, max: 70 },
  weeklyChangeKg: { min: 0, max: 2 },
} as const;
