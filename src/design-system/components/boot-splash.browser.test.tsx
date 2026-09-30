import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BootSplash } from "./boot-splash";
import { SPLASH_ATTRIBUTE } from "./boot-splash-script";

/**
 * Roadmap 8.12 (30/09/2026): num recarregamento no meio da sessão, a
 * transição de entrada não aparece nem por um quadro. Quem decide é o CSS de
 * `globals.css` sobre o atributo que o script põe antes do paint.
 */
describe("8.12 — a transição some quando a sessão já a mostrou", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(SPLASH_ATTRIBUTE);
  });

  it("na abertura, cobre a tela", () => {
    const { container } = render(<BootSplash />);
    const overlay = container.querySelector("[data-boot-splash]")!;

    expect(getComputedStyle(overlay).display).not.toBe("none");
  });

  it("num recarregamento na mesma sessão, não aparece", () => {
    document.documentElement.setAttribute(SPLASH_ATTRIBUTE, "skip");
    const { container } = render(<BootSplash />);
    const overlay = container.querySelector("[data-boot-splash]")!;

    expect(getComputedStyle(overlay).display).toBe("none");
  });
});
