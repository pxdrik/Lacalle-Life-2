import { describe, expect, it } from "vitest";

import {
  DEFAULT_DENSITY,
  defaultDensityForWidth,
  DESKTOP_DENSITY_BREAKPOINT_PX,
  parseDensity,
} from "./density";

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

describe("defaultDensityForWidth", () => {
  // Pedro, 26/08/2026: "no PC, o Confortável deve ser o padrão" — a desktop
  // screen already has the room `comfortable` asks for, so starting cramped
  // there was never the point of a conservative default.
  it("is comfortable at and above the desktop breakpoint", () => {
    expect(defaultDensityForWidth(DESKTOP_DENSITY_BREAKPOINT_PX)).toBe(
      "comfortable",
    );
    expect(defaultDensityForWidth(1920)).toBe("comfortable");
  });

  it("stays the ordinary default below the desktop breakpoint", () => {
    expect(defaultDensityForWidth(DESKTOP_DENSITY_BREAKPOINT_PX - 1)).toBe(
      DEFAULT_DENSITY,
    );
    expect(defaultDensityForWidth(390)).toBe(DEFAULT_DENSITY);
  });
});
