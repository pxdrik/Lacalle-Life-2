import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Signature } from "./signature";

/**
 * Roadmap 8.11 (30/09/2026): o símbolo da assinatura em Verdant, como o Brand
 * System V2 define para o Life. A régua é a cor resolvida, não a classe.
 */
function srgb(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const [r, g, b] = color.match(/\d+(\.\d+)?/g)!.map(Number) as [number, number, number];
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

function colorOf(className: string, property: "color" | "backgroundColor"): string {
  const probe = document.createElement("span");
  probe.className = className;
  document.body.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

describe("8.11 — o símbolo da assinatura é Verdant", () => {
  it.each(["light", "dark"] as const)("%s", (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      const { container } = render(<Signature />);
      const mark = container.querySelector("svg")!;
      const fill = getComputedStyle(mark).color;

      expect(fill).toBe(colorOf("text-accent", "color"));
      // Objeto gráfico: piso de 3:1 (WCAG 1.4.11) contra o fundo do cabeçalho.
      expect(ratio(fill, colorOf("bg-surface", "backgroundColor"))).toBeGreaterThanOrEqual(3);
    } finally {
      document.documentElement.removeAttribute("data-theme");
    }
  });
});
