/**
 * A nutrition quantity.
 *
 * The same shape describes a food's values per 100 g, a portion's
 * contribution, a meal's total and a daily target — one vocabulary instead of
 * four near-identical record types.
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

export const ZERO_MACROS: Macros = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

/** Values for `grams` of a food described per 100 g. */
export function scaleMacros(per100g: Macros, grams: number): Macros {
  const factor = grams / 100;

  return {
    kcal: per100g.kcal * factor,
    proteinG: per100g.proteinG * factor,
    carbsG: per100g.carbsG * factor,
    fatG: per100g.fatG * factor,
  };
}

/**
 * Display precision: whole calories, one decimal for grams.
 *
 * Rounding happens per portion, *before* totals are summed, so the numbers on
 * screen always add up. Summing at full precision and rounding only the total
 * is more accurate in the abstract and worse in practice — someone checking a
 * column by hand finds an answer that disagrees with their arithmetic, and
 * stops trusting the app.
 */
export function roundMacros(macros: Macros): Macros {
  return {
    kcal: Math.round(macros.kcal),
    proteinG: roundGrams(macros.proteinG),
    carbsG: roundGrams(macros.carbsG),
    fatG: roundGrams(macros.fatG),
  };
}

/**
 * A total that one unreadable value cannot destroy.
 *
 * The type says these are numbers; storage does not obey the type. A row
 * written by an older version, hand-edited, or corrupted holds whatever it
 * holds — and `NaN + 100` is `NaN`, so a single bad food used to turn the
 * whole day's calories into nothing. One item nobody can read is a small
 * problem; every other number on the screen disappearing with it is not.
 *
 * The bad value is skipped rather than repaired, and only here, in the sum.
 * `scaleMacros` deliberately lets it through, so the offending row still
 * renders as `—` via `formatDecimal` — the dash is where the truth is told.
 * Coercing it to zero there would print a confident "0 kcal" for a food whose
 * calories are unknown, which is the worse lie.
 */
export function sumMacros(all: Iterable<Macros>): Macros {
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;

  for (const macros of all) {
    kcal += readable(macros.kcal);
    proteinG += readable(macros.proteinG);
    carbsG += readable(macros.carbsG);
    fatG += readable(macros.fatG);
  }

  // Rounded on the way out: repeated addition of one-decimal values still
  // lands on things like 58.800000000000004.
  return {
    kcal: Math.round(kcal),
    proteinG: roundGrams(proteinG),
    carbsG: roundGrams(carbsG),
    fatG: roundGrams(fatG),
  };
}

function roundGrams(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Contributes nothing rather than poisoning the addition. */
function readable(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
