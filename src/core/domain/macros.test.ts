import { describe, expect, it } from "vitest";

import {
  roundMacros,
  scaleMacros,
  sumMacros,
  ZERO_MACROS,
  type Macros,
} from "./macros";

const CHICKEN: Macros = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };

describe("scaleMacros", () => {
  it("returns the food itself at 100 g", () => {
    expect(scaleMacros(CHICKEN, 100)).toEqual(CHICKEN);
  });

  it("halves at 50 g", () => {
    expect(scaleMacros(CHICKEN, 50)).toEqual({
      kcal: 82.5,
      proteinG: 15.5,
      carbsG: 0,
      fatG: 1.8,
    });
  });

  it("scales above 100 g", () => {
    expect(scaleMacros(CHICKEN, 200).proteinG).toBe(62);
  });

  it("is zero at zero grams", () => {
    expect(scaleMacros(CHICKEN, 0)).toEqual(ZERO_MACROS);
  });

  it("keeps full precision, leaving rounding to the caller", () => {
    // 33 g of chicken is 10.23 g of protein. Rounding here would push error
    // into every total built from it.
    expect(scaleMacros(CHICKEN, 33).proteinG).toBeCloseTo(10.23, 10);
  });
});

describe("roundMacros", () => {
  it("rounds calories to whole numbers and grams to one decimal", () => {
    expect(
      roundMacros({ kcal: 82.5, proteinG: 15.55, carbsG: 0.04, fatG: 1.84 }),
    ).toEqual({
      kcal: 83,
      proteinG: 15.6,
      carbsG: 0,
      fatG: 1.8,
    });
  });

  it("leaves already-rounded values alone", () => {
    expect(roundMacros(CHICKEN)).toEqual(CHICKEN);
  });
});

describe("sumMacros", () => {
  it("is zero for nothing", () => {
    expect(sumMacros([])).toEqual(ZERO_MACROS);
  });

  it("adds every field", () => {
    const total = sumMacros([
      { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
      { kcal: 250, proteinG: 3, carbsG: 50, fatG: 1 },
    ]);

    expect(total).toEqual({ kcal: 350, proteinG: 13, carbsG: 55, fatG: 3 });
  });

  it("does not leak floating-point noise into the total", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point. A total that
    // renders as that is a total nobody trusts.
    const total = sumMacros([
      { kcal: 0, proteinG: 0.1, carbsG: 0, fatG: 0 },
      { kcal: 0, proteinG: 0.2, carbsG: 0, fatG: 0 },
    ]);

    expect(total.proteinG).toBe(0.3);
  });

  it("adds up to exactly what the rounded parts show", () => {
    // The reason rounding happens per portion rather than at the total:
    // someone adding the column by hand must reach the printed figure.
    const portions = [
      roundMacros(scaleMacros(CHICKEN, 33)),
      roundMacros(scaleMacros(CHICKEN, 67)),
    ];

    const total = sumMacros(portions);
    const byHand = portions.reduce((acc, p) => acc + p.proteinG, 0);

    expect(total.proteinG).toBeCloseTo(byHand, 10);
  });
});

/**
 * Storage does not obey the type.
 *
 * Every value here is one a real `IndexedDB` row can hold: written by a
 * version that validated less, hand-edited, or corrupted. The schema rejects
 * all of them on the way in, which protects the form and nothing else — the
 * rows that are already stored never pass through it again.
 */
describe("a stored value that is not a number", () => {
  const good = { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 };

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "does not destroy the total when one item holds %p",
    (broken) => {
      const total = sumMacros([good, { ...good, kcal: broken }, good]);

      // The readable items still add up. Without the guard this was NaN, and
      // every figure on the screen went with it.
      expect(total.kcal).toBe(200);
      expect(total.proteinG).toBe(30);
    },
  );

  it("skips the unreadable field only, not the whole item", () => {
    const total = sumMacros([{ ...good, kcal: Number.NaN }]);

    expect(total.kcal).toBe(0);
    expect(total.proteinG).toBe(10);
  });

  it("leaves the offending portion alone, so its own row can say so", () => {
    // `scaleMacros` passes it through on purpose: the item renders as `—`,
    // which is the truth. Coercing to zero here would print a confident
    // "0 kcal" for a food whose calories nobody knows.
    const scaled = scaleMacros({ ...good, kcal: Number.NaN }, 100);

    expect(Number.isNaN(scaled.kcal)).toBe(true);
  });
});
