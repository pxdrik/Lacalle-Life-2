import { describe, expect, it } from "vitest";

import { weeklyRatePresets } from "./rate-presets";

describe("weeklyRatePresets", () => {
  it("never offers a cut preset above the sustainable ceiling", () => {
    // 60 kg * 1% = 0.6 kg/week — the exact case from the roadmap: a fixed
    // "1 kg/semana" preset would already be unsafe here.
    const presets = weeklyRatePresets(60, "cut");

    expect(presets.map((p) => p.weeklyChangeKg)).toEqual([0.3, 0.6]);
    for (const preset of presets) {
      expect(preset.weeklyChangeKg).toBeLessThanOrEqual(0.6);
    }
  });

  it("never offers a bulk preset above the (much smaller) gain ceiling", () => {
    // 60 kg * 0.5% = 0.3 kg/week.
    const presets = weeklyRatePresets(60, "bulk");

    expect(presets.map((p) => p.weeklyChangeKg)).toEqual([0.15, 0.3]);
  });

  it("scales with bodyweight, not a fixed number", () => {
    const lighter = weeklyRatePresets(50, "cut");
    const heavier = weeklyRatePresets(100, "cut");

    expect(heavier[1]?.weeklyChangeKg).toBeGreaterThan(
      lighter[1]?.weeklyChangeKg ?? 0,
    );
  });
});
