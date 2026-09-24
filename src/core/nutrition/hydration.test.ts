import { describe, expect, it } from "vitest";

import { computeHydrationTargetMl } from "./hydration";

describe("computeHydrationTargetMl", () => {
  it("multiplies bodyweight in kg by 35 mL", () => {
    expect(computeHydrationTargetMl(80)).toBe(2800);
  });

  it("rounds to a whole millilitre", () => {
    expect(computeHydrationTargetMl(63.4)).toBe(Math.round(63.4 * 35));
  });
});
