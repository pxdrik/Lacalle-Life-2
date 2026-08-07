import { describe, expect, it } from "vitest";

import { dayKey, formatDay, formatShortDay, isFutureDay } from "./day";

describe("dayKey", () => {
  it("uses the local calendar day, not UTC", () => {
    // 21:00 in São Paulo is already tomorrow in UTC. Filing that weigh-in
    // under the next day would put two readings on one date and none on
    // another — a kink in the trend line that never happened.
    expect(dayKey(new Date(2026, 7, 7, 21, 30))).toBe("2026-08-07");
  });

  it("pads single-digit months and days, so the key sorts as text", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("produces keys that sort chronologically as plain strings", () => {
    const days = [
      dayKey(new Date(2026, 8, 1)),
      dayKey(new Date(2026, 0, 5)),
      dayKey(new Date(2026, 7, 7)),
    ].sort();

    expect(days).toEqual(["2026-01-05", "2026-08-07", "2026-09-01"]);
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

describe("formatShortDay", () => {
  it("drops the year, for axes where it is implied", () => {
    expect(formatShortDay("2026-08-07")).toBe("07/08");
  });
});

describe("isFutureDay", () => {
  const now = new Date(2026, 7, 7, 12, 0);

  it("rejects tomorrow", () => {
    expect(isFutureDay("2026-08-08", now)).toBe(true);
  });

  it("accepts today, whatever the hour", () => {
    // Recording this morning's weigh-in at 23:00 is still today.
    expect(isFutureDay("2026-08-07", now)).toBe(false);
  });

  it("accepts any past day", () => {
    expect(isFutureDay("2025-12-31", now)).toBe(false);
  });
});
