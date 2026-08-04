import { describe, expect, it } from "vitest";

import { parseThemePreference, resolveTheme } from "./theme";

describe("parseThemePreference", () => {
  it.each(["light", "dark", "system"] as const)("accepts %s", (value) => {
    expect(parseThemePreference(value)).toBe(value);
  });

  // localStorage is user-writable and outlives app versions, so every one of
  // these is a value a real browser can hand us.
  it.each([null, undefined, "", "Dark", "solarized", 1, {}, []])(
    "falls back to system for %p",
    (value) => {
      expect(parseThemePreference(value)).toBe("system");
    },
  );
});

describe("resolveTheme", () => {
  it.each([
    ["light", true, "light"],
    ["light", false, "light"],
    ["dark", true, "dark"],
    ["dark", false, "dark"],
  ] as const)(
    "keeps an explicit %s choice regardless of the OS",
    (preference, systemPrefersDark, expected) => {
      expect(resolveTheme(preference, systemPrefersDark)).toBe(expected);
    },
  );

  it("follows the OS when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
