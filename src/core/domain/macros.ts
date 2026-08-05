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

export function sumMacros(all: Iterable<Macros>): Macros {
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;

  for (const macros of all) {
    kcal += macros.kcal;
    proteinG += macros.proteinG;
    carbsG += macros.carbsG;
    fatG += macros.fatG;
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
