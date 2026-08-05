/**
 * A nutrition quantity.
 *
 * The same shape describes a food's values per 100 g, a portion's contribution,
 * a meal's total and a daily target — so there is one vocabulary for all of
 * them rather than four near-identical record types.
 *
 * `kcal` is stored rather than derived. Atwater factors (4/4/9) overestimate
 * any food with meaningful fibre, which yields ~2 kcal/g rather than 4:
 * lemon reads 29 kcal but computes to 43. The measured value is the truth.
 */
export interface Macros {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}
