import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { themeScriptSource } from "./theme-script";
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme";

/**
 * Executes the real script string rather than a reimplementation of it.
 *
 * The pre-hydration script necessarily duplicates the logic in `theme.ts` —
 * it has to run before any module is loaded. Running the shipped source here
 * is what stops the two from drifting apart silently.
 *
 * `new Function` executes an imported module constant with nothing
 * interpolated into it, in a test that never ships. Evaluating the real
 * source is the entire point; asserting against a copy would test nothing.
 */
function runThemeScript(): void {
  new Function(themeScriptSource)();
}

function stubSystemPrefersDark(matches: boolean): void {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  document.documentElement.style.colorScheme = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const theme = () => document.documentElement.getAttribute(THEME_ATTRIBUTE);

describe("theme script", () => {
  it("follows the OS when nothing is stored", () => {
    stubSystemPrefersDark(true);
    runThemeScript();

    expect(theme()).toBe("dark");
  });

  it("defaults to light when the OS has no dark preference", () => {
    stubSystemPrefersDark(false);
    runThemeScript();

    expect(theme()).toBe("light");
  });

  it.each([
    ["dark", true],
    ["light", false],
  ] as const)(
    "honours a stored %s preference over the opposite OS setting",
    (stored, systemPrefersDark) => {
      window.localStorage.setItem(THEME_STORAGE_KEY, stored);
      stubSystemPrefersDark(!systemPrefersDark);
      runThemeScript();

      expect(theme()).toBe(stored);
    },
  );

  it("defers to the OS when the stored preference is system", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    stubSystemPrefersDark(true);
    runThemeScript();

    expect(theme()).toBe("dark");
  });

  it("ignores an unrecognised stored value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "solarized");
    stubSystemPrefersDark(true);
    runThemeScript();

    expect(theme()).toBe("dark");
  });

  it("sets color-scheme so native controls and scrollbars match", () => {
    stubSystemPrefersDark(true);
    runThemeScript();

    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("survives a browser that blocks storage entirely", () => {
    stubSystemPrefersDark(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => {
      runThemeScript();
    }).not.toThrow();
  });
});
