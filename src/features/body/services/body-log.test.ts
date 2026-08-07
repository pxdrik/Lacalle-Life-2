import { describe, expect, it } from "vitest";

import {
  changeIn,
  chronological,
  createBodyEntry,
  dayKey,
  EMPTY_MEASUREMENTS,
  formatDay,
  movingAverage,
  seriesOf,
} from "./body-log";
import { MEASUREMENT_SITES } from "../taxonomy/measurement-sites";
import { isEmptyEntry, type BodyEntry } from "../types/body-entry";

function entry(day: string, over: Partial<BodyEntry> = {}): BodyEntry {
  return { ...createBodyEntry(day), ...over };
}

describe("dayKey", () => {
  it("uses the local calendar day, not UTC", () => {
    // 21:00 in São Paulo is already tomorrow in UTC. Filing that weigh-in
    // under the next day would put two readings on one date and none on
    // another, which is a kink in the trend line that never happened.
    const late = new Date(2026, 7, 7, 21, 30);

    expect(dayKey(late)).toBe("2026-08-07");
  });

  it("pads single-digit months and days, so the key sorts as text", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("createBodyEntry", () => {
  it("uses the day as the id, so logging twice corrects instead of duplicating", () => {
    expect(createBodyEntry("2026-08-07").id).toBe("2026-08-07");
  });

  it("starts with every site unmeasured rather than zero", () => {
    const fresh = createBodyEntry("2026-08-07");

    for (const site of MEASUREMENT_SITES) {
      expect(fresh.measurements[site], site).toBeNull();
    }
    expect(isEmptyEntry(fresh)).toBe(true);
  });
});

describe("isEmptyEntry", () => {
  it("does not treat a weight of zero as empty", () => {
    // Nonsense as a body weight, but the rule is about `null` versus a number:
    // silently discarding a typed value would lose data the user entered.
    expect(isEmptyEntry(entry("2026-08-07", { weightKg: 0 }))).toBe(false);
  });

  it("ignores whitespace-only notes", () => {
    expect(isEmptyEntry(entry("2026-08-07", { notes: "   " }))).toBe(true);
  });

  it("counts a single measurement as content", () => {
    expect(
      isEmptyEntry(
        entry("2026-08-07", {
          measurements: { ...EMPTY_MEASUREMENTS, waist: 82 },
        }),
      ),
    ).toBe(false);
  });
});

describe("chronological", () => {
  it("orders by day without parsing dates", () => {
    const ordered = chronological([
      entry("2026-08-10"),
      entry("2026-07-31"),
      entry("2026-08-02"),
    ]);

    expect(ordered.map((item) => item.day)).toEqual([
      "2026-07-31",
      "2026-08-02",
      "2026-08-10",
    ]);
  });
});

describe("seriesOf", () => {
  it("skips days where the value was not recorded, rather than inventing one", () => {
    // Drawing a line through a weight nobody measured is fabricated data, and
    // the chart exists to show what actually happened.
    const points = seriesOf(
      [
        entry("2026-08-01", { weightKg: 82 }),
        entry("2026-08-02", { weightKg: null }),
        entry("2026-08-03", { weightKg: 81.5 }),
      ],
      (item) => item.weightKg,
    );

    expect(points).toEqual([
      { day: "2026-08-01", value: 82 },
      { day: "2026-08-03", value: 81.5 },
    ]);
  });

  it("keeps a recorded zero", () => {
    const points = seriesOf([entry("2026-08-01", { bodyFatPercent: 0 })], (i) => i.bodyFatPercent);

    expect(points).toHaveLength(1);
  });
});

describe("changeIn", () => {
  it("reports no change when there is only one reading", () => {
    const change = changeIn([{ day: "2026-08-01", value: 82 }]);

    expect(change?.delta).toBeNull();
    expect(change?.previous).toBeNull();
  });

  it("compares against the previous reading, not the previous day", () => {
    // Someone who weighs in weekly has six unrecorded days in between, and
    // the number they want is "since last time", not "since yesterday".
    const change = changeIn([
      { day: "2026-08-01", value: 82 },
      { day: "2026-08-08", value: 81.2 },
    ]);

    expect(change?.delta).toBeCloseTo(-0.8);
    expect(change?.previous?.day).toBe("2026-08-01");
  });

  it("returns null for an empty series", () => {
    expect(changeIn([])).toBeNull();
  });
});

describe("movingAverage", () => {
  it("smooths the daily swing that hides a real trend", () => {
    const raw = [
      { day: "2026-08-01", value: 82 },
      { day: "2026-08-02", value: 83 },
      { day: "2026-08-03", value: 81 },
      { day: "2026-08-04", value: 82 },
    ];

    const smoothed = movingAverage(raw, 3);

    // Each point averages itself and up to two before it — never the future,
    // which would let tomorrow's weight bend today's line.
    expect(smoothed[0]?.value).toBe(82);
    expect(smoothed[1]?.value).toBe(82.5);
    expect(smoothed[2]?.value).toBe(82);
    expect(smoothed[3]?.value).toBeCloseTo(82);
  });

  it("averages over readings, not calendar days", () => {
    // Weekly weigh-ins would otherwise fall into a mostly empty window and
    // the "average" would just be the raw value again.
    const weekly = [
      { day: "2026-08-01", value: 80 },
      { day: "2026-08-08", value: 84 },
    ];

    expect(movingAverage(weekly, 2)[1]?.value).toBe(82);
  });

  it("returns the readings untouched for a window of one", () => {
    const raw = [{ day: "2026-08-01", value: 82 }];
    expect(movingAverage(raw, 1)).toEqual(raw);
  });
});

describe("formatDay", () => {
  it("reads as a Brazilian date", () => {
    expect(formatDay("2026-08-07")).toBe("07/08/2026");
  });

  it("returns anything unparseable unchanged instead of throwing", () => {
    expect(formatDay("hoje")).toBe("hoje");
  });
});
