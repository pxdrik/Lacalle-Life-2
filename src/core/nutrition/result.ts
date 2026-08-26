import type { Macros } from "@/core/domain/macros";

/**
 * Something the engine changed about what was asked for. The plan is still
 * valid — the user just did not get exactly what they requested, and saying so
 * is the difference between a tool and a black box.
 */
export type AdvisoryCode =
  | "DEFICIT_CLAMPED"
  | "SURPLUS_CLAMPED"
  | "WEEKLY_RATE_CLAMPED"
  | "TARGET_RAISED_TO_FLOOR";

export interface Advisory {
  readonly code: AdvisoryCode;
  readonly message: string;
}

/**
 * A reason the engine refuses to emit a plan at all. Anything reaching here
 * has already survived input validation and every clamp, so a violation means
 * no safe plan exists for that profile.
 */
export type ViolationCode =
  | "BELOW_ABSOLUTE_FLOOR"
  | "BELOW_RESTING_EXPENDITURE"
  | "PROTEIN_EXCEEDS_SAFE_MAX"
  | "CARBS_BELOW_FLOOR"
  | "FAT_BELOW_FLOOR"
  | "MACROS_INCONSISTENT_WITH_ENERGY";

export interface Violation {
  readonly code: ViolationCode;
  readonly message: string;
}

export interface NutritionPlan {
  readonly bmrKcal: number;
  readonly tdeeKcal: number;
  /**
   * Daily targets, as `Macros` — the same type a diet's totals are measured
   * in, so comparing the two is a field-by-field read rather than a
   * conversion. `kcal` here is the energy target.
   */
  readonly targets: Macros;
  /** Signed: negative for a deficit, positive for a surplus. */
  readonly energyBalanceKcal: number;
  readonly projectedWeeklyChangeKg: number;
  readonly advisories: readonly Advisory[];
}

/**
 * Either a plan or the reasons there isn't one. Modelled as a union so a
 * caller cannot read `plan` without having checked — an unsafe target must not
 * be reachable by forgetting an `if`.
 */
export type PlanResult =
  | { readonly ok: true; readonly plan: NutritionPlan }
  | { readonly ok: false; readonly violations: readonly Violation[] };

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
