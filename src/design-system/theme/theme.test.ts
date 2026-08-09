import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, parseThemePreference, resolveTheme } from "./theme";

describe("parseThemePreference", () => {
  it.each(["light", "dark", "system"] as const)("accepts %s", (value) => {
    expect(parseThemePreference(value)).toBe(value);
  });

  // localStorage is user-writable and outlives app versions, so every one of
  // these is a value a real browser can hand us.
  it.each([null, undefined, "", "Dark", "solarized", 1, {}, []])(
    "falls back to the default for %p",
    (value) => {
      expect(parseThemePreference(value)).toBe(DEFAULT_THEME);
    },
  );

  it("defaults to dark, because the identity was designed on a dark ground", () => {
    // Asserted as a literal rather than through the constant: this is the
    // product decision itself, and a test that reads the constant back would
    // agree with any value someone typed there.
    expect(DEFAULT_THEME).toBe("dark");
  });
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
