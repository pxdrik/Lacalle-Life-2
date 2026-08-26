import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { densityScriptSource } from "./density-script";
import { DENSITY_ATTRIBUTE, DENSITY_STORAGE_KEY } from "./density";

/**
 * Executes the real script string rather than a reimplementation of it —
 * same reasoning as `theme-script.test.ts`. The pre-hydration script
 * necessarily duplicates the logic in `density.ts`; running the shipped
 * source here is what stops the two from drifting apart silently.
 */
function runDensityScript(): void {
  new Function(densityScriptSource)();
}

function setInnerWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

const ORIGINAL_WIDTH = window.innerWidth;
const density = () => document.documentElement.getAttribute(DENSITY_ATTRIBUTE);

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(DENSITY_ATTRIBUTE);
});

afterEach(() => {
  setInnerWidth(ORIGINAL_WIDTH);
  vi.restoreAllMocks();
});

// Pedro, 26/08/2026: "no PC, o Confortável deve ser o padrão" — with no
// stored choice, the very first paint now depends on the screen it is
// asked on, not one fixed constant for everyone.
describe("density script", () => {
  it("starts comfortable on a desktop-width screen with nothing stored", () => {
    setInnerWidth(1920);
    runDensityScript();

    expect(density()).toBe("comfortable");
  });

  it("starts at the ordinary default on a phone-width screen with nothing stored", () => {
    setInnerWidth(390);
    runDensityScript();

    expect(density()).toBe("default");
  });

  it("honours a stored choice over the screen width", () => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
    setInnerWidth(1920);
    runDensityScript();

    expect(density()).toBe("compact");
  });

  it("ignores an unrecognised stored value and falls back by width", () => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, "huge");
    setInnerWidth(1920);
    runDensityScript();

    expect(density()).toBe("comfortable");
  });

  it("survives a browser that blocks storage entirely", () => {
    setInnerWidth(1920);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => {
      runDensityScript();
    }).not.toThrow();
  });
});
