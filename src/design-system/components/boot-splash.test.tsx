import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BootSplash } from "./boot-splash";

/** jsdom has no `matchMedia` — see the same helper in `theme-provider.test.tsx`. */
function installMatchMedia(prefersReducedMotion: boolean) {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: prefersReducedMotion,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const overlay = () => document.querySelector('[aria-hidden="true"]');

describe("BootSplash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("covers the screen on mount", () => {
    installMatchMedia(false);
    render(<BootSplash />);

    expect(overlay()).not.toBeNull();
  });

  it("removes itself once the reveal finishes", () => {
    installMatchMedia(false);
    render(<BootSplash />);

    // Expand + hold + collapse + the 40ms buffer — comfortably past it.
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(overlay()).toBeNull();
  });

  it("skips the circle animation and fades out quickly under prefers-reduced-motion", () => {
    installMatchMedia(true);
    render(<BootSplash />);

    expect(overlay()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(overlay()).toBeNull();
  });
});
