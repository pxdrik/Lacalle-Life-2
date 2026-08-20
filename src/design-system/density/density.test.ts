import { describe, expect, it } from "vitest";

import { DEFAULT_DENSITY, parseDensity } from "./density";

describe("parseDensity", () => {
  it.each(["compact", "default", "comfortable"] as const)(
    "accepts %s",
    (value) => {
      expect(parseDensity(value)).toBe(value);
    },
  );

  // localStorage is user-writable and outlives app versions, so every one of
  // these is a value a real browser can hand us.
  it.each([null, undefined, "", "Compact", "huge", 1, {}, []])(
    "falls back to the default for %p",
    (value) => {
      expect(parseDensity(value)).toBe(DEFAULT_DENSITY);
    },
  );

  it("defaults to the brand system's own control heights, untouched", () => {
    expect(DEFAULT_DENSITY).toBe("default");
  });
});
