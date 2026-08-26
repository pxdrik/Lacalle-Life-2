import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DENSITY_STORAGE_KEY } from "./density";

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

const ORIGINAL_WIDTH = window.innerWidth;

beforeEach(() => {
  window.localStorage.clear();
  // The module keeps a cached `current` at module scope, so a fresh import
  // per test is the only way to exercise the very first `getDensity()` call
  // — the one this behaviour lives in — instead of a cached value left over
  // from a previous test.
  vi.resetModules();
});

afterEach(() => {
  setInnerWidth(ORIGINAL_WIDTH);
});

// Pedro, 26/08/2026: "no PC, o Confortável deve ser o padrão" — with no
// stored choice, the resolved density now depends on the screen it is
// asked on, not one fixed constant for everyone.
describe("getDensity", () => {
  it("resolves to comfortable on a desktop-width screen with no stored choice", async () => {
    setInnerWidth(1920);
    const { getDensity } = await import("./density-store");

    expect(getDensity()).toBe("comfortable");
  });

  it("resolves to the ordinary default on a phone-width screen with no stored choice", async () => {
    setInnerWidth(390);
    const { getDensity } = await import("./density-store");

    expect(getDensity()).toBe("default");
  });

  it("an explicit stored choice wins regardless of screen width", async () => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
    setInnerWidth(1920);
    const { getDensity } = await import("./density-store");

    expect(getDensity()).toBe("compact");
  });
});
