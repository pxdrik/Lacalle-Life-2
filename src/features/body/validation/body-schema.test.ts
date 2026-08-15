import { describe, expect, it } from "vitest";

import { INPUT_BOUNDS } from "@/core/nutrition";

import { MEASUREMENT_SITES } from "../taxonomy/measurement-sites";
import { bodyEntrySchema } from "./body-schema";

/**
 * The validation `features/body` did not have.
 *
 * It was the only feature without a `validation/`, and the consequence was
 * measured rather than imagined: −15 kg was accepted, became "peso atual", and
 * dragged the trend line and the 30-day delta with it. The chart that exists
 * to show whether the number is moving was reporting a number nobody weighed.
 */

const EMPTY_SITES = Object.fromEntries(
  MEASUREMENT_SITES.map((site) => [site, null]),
);

const entry = (over: Record<string, unknown> = {}) => ({
  weightKg: null,
  bodyFatPercent: null,
  measurements: EMPTY_SITES,
  ...over,
});

describe("weight", () => {
  it("refuses a negative weight", () => {
    // The case the audit reproduced in the browser.
    expect(bodyEntrySchema.safeParse(entry({ weightKg: -15 })).success).toBe(
      false,
    );
  });

  it("refuses a weight nobody has", () => {
    expect(bodyEntrySchema.safeParse(entry({ weightKg: 9999 })).success).toBe(
      false,
    );
  });

  it("refuses zero, which is a slipped digit and not a weight", () => {
    expect(bodyEntrySchema.safeParse(entry({ weightKg: 0 })).success).toBe(
      false,
    );
  });

  it("accepts both ends of the range the nutrition engine already uses", () => {
    // Shared bounds on purpose: two ranges for one quantity is how the app
    // would come to disagree with itself about a plausible weight.
    for (const value of [INPUT_BOUNDS.weightKg.min, INPUT_BOUNDS.weightKg.max])
      expect(bodyEntrySchema.safeParse(entry({ weightKg: value })).success).toBe(
        true,
      );
  });

  it("accepts a decimal, which is how a scale reads", () => {
    expect(bodyEntrySchema.safeParse(entry({ weightKg: 82.5 })).success).toBe(
      true,
    );
  });

  it("accepts blank, because every field is optional", () => {
    // Somebody who only measures a waist should never be told to weigh in.
    expect(bodyEntrySchema.safeParse(entry()).success).toBe(true);
  });

  it("names the field it rejected, so the form can put the message on it", () => {
    const parsed = bodyEntrySchema.safeParse(entry({ weightKg: -15 }));

    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues[0]?.path.join(".")).toBe("weightKg");
  });

  it("says the whole range rather than the bound it hit", () => {
    const parsed = bodyEntrySchema.safeParse(entry({ weightKg: 3 }));

    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues[0]?.message).toContain("entre 30 e 300 kg");
  });
});

describe("body fat", () => {
  it("refuses a negative percentage", () => {
    expect(
      bodyEntrySchema.safeParse(entry({ bodyFatPercent: -2 })).success,
    ).toBe(false);
  });

  it("refuses more than a body can be made of", () => {
    expect(
      bodyEntrySchema.safeParse(entry({ bodyFatPercent: 120 })).success,
    ).toBe(false);
  });

  it("accepts a plausible one", () => {
    expect(bodyEntrySchema.safeParse(entry({ bodyFatPercent: 18 })).success).toBe(
      true,
    );
  });
});

describe("measurements", () => {
  it("refuses a negative or absurd value at every site", () => {
    // All nine, because the hole was in the shape of the form and not of one
    // field: a site added to the taxonomy has to arrive validated.
    for (const site of MEASUREMENT_SITES) {
      for (const value of [-1, 0, 5000]) {
        const parsed = bodyEntrySchema.safeParse(
          entry({ measurements: { ...EMPTY_SITES, [site]: value } }),
        );

        expect(parsed.success).toBe(false);
        if (!parsed.success)
          expect(parsed.error.issues[0]?.path.join(".")).toBe(
            `measurements.${site}`,
          );
      }
    }
  });

  it("accepts real tape readings", () => {
    expect(
      bodyEntrySchema.safeParse(
        entry({
          measurements: { ...EMPTY_SITES, neck: 38, waist: 81.5, calf: 37 },
        }),
      ).success,
    ).toBe(true);
  });

  it("accepts a day where only one site was measured", () => {
    expect(
      bodyEntrySchema.safeParse(
        entry({ measurements: { ...EMPTY_SITES, waist: 81 } }),
      ).success,
    ).toBe(true);
  });
});
