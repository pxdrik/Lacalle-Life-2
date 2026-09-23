import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ICON_GRADIENT } from "@/design-system/brand/mark";

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

  // Pedido do Pedro (23/09/2026): "vamos transformar ela em verde esmeralda,
  // igual a da logo" — mesmo gradiente do ícone do app, não uma cor digitada
  // de novo aqui.
  it("uses the same gradient as the app icon, not the old black overlay", () => {
    installMatchMedia(false);
    render(<BootSplash />);

    // jsdom normaliza hex para `rgb(...)` ao ler `style.background` de
    // volta — comparar contra o elemento renderido de verdade em vez do
    // literal hexadecimal de `ICON_GRADIENT`.
    const probe = document.createElement("div");
    probe.style.background = `linear-gradient(${String(ICON_GRADIENT.angle)}deg, ${ICON_GRADIENT.from}, ${ICON_GRADIENT.to})`;

    expect((overlay() as HTMLElement).style.background).toBe(
      probe.style.background,
    );
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
