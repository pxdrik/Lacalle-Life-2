/**
 * The nutrition engine.
 *
 * The single official source of BMR, TDEE, calorie targets, macro
 * distribution and their safety checks. Nothing else in the application
 * computes any of them.
 *
 * That rule is not bureaucracy. The V1 audit found a README claiming
 * Mifflin-St Jeor, a module implementing Harris-Benedict revised, and a test
 * documenting Harris-Benedict original — with an assertion loose enough that
 * all three passed. One implementation, one set of tests, one answer.
 */
export {
  ACTIVITY_LEVELS,
  BIOLOGICAL_SEXES,
  GOALS,
  INPUT_BOUNDS,
  type ActivityLevel,
  type BiologicalSex,
  type Goal,
} from "./constants";

export {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  SEX_LABELS,
  nutritionProfileSchema,
  type NutritionProfile,
} from "./profile";

export { buildNutritionPlan } from "./plan";

export { weeklyRatePresets, type RatePreset } from "./rate-presets";

export {
  type Advisory,
  type AdvisoryCode,
  type NutritionPlan,
  type PlanResult,
  type Violation,
  type ViolationCode,
} from "./result";
