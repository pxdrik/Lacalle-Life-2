import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MacroDonut } from "./macro-donut";

/**
 * Roadmap 8.8 (29/09/2026): os percentuais do donut se sobrepunham.
 *
 * Relatado pelo Pedro no resumo do plano (Perfil): "25%" e "25%" amontoados
 * no topo e "50%" em cima do anel. Eles eram desenhados sobre o traço, que em
 * 64px tem ~10px de espessura, menos que a largura do texto.
 *
 * A régua é a caixa desenhada de cada rótulo (`getBBox`), em unidades do SVG:
 * nada disso existe em jsdom.
 */
type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** A menor distância entre o centro e um ponto do retângulo. */
function nearest(box: Box, cx: number, cy: number): number {
  const dx = Math.max(box.x - cx, 0, cx - (box.x + box.width));
  const dy = Math.max(box.y - cy, 0, cy - (box.y + box.height));
  return Math.hypot(dx, dy);
}

const SPLITS: [number, number, number][] = [
  [25, 50, 25],
  [30, 40, 30],
  [20, 50, 30],
  [10, 80, 10],
  [40, 20, 40],
];

describe("8.8 — os percentuais ficam fora do anel e não se sobrepõem", () => {
  for (const size of [56, 64]) {
    for (const [p, c, f] of SPLITS) {
      it(`${String(size)}px, ${String(p)}/${String(c)}/${String(f)}`, () => {
        const { container } = render(
          <MacroDonut size={size} shares={{ proteinG: p, carbsG: c, fatG: f }} />,
        );
        const svg = container.querySelector("svg")!;
        const ring = svg.querySelector("circle")!;
        const cx = Number(ring.getAttribute("cx"));
        const cy = Number(ring.getAttribute("cy"));
        const outer =
          Number(ring.getAttribute("r")) +
          Number(ring.getAttribute("stroke-width")) / 2;
        const view = svg.viewBox.baseVal;
        const labels = [...svg.querySelectorAll("text")].map((text) => ({
          text: text.textContent ?? "",
          box: text.getBBox(),
        }));

        expect(labels.length).toBeGreaterThan(0);
        for (const [index, label] of labels.entries()) {
          expect(
            nearest(label.box, cx, cy),
            `"${label.text}" encosta no anel`,
          ).toBeGreaterThanOrEqual(outer);
          expect(label.box.x, `"${label.text}" sai pela esquerda`).toBeGreaterThanOrEqual(0);
          expect(label.box.y, `"${label.text}" sai por cima`).toBeGreaterThanOrEqual(0);
          expect(
            label.box.x + label.box.width,
            `"${label.text}" sai pela direita`,
          ).toBeLessThanOrEqual(view.width);
          expect(
            label.box.y + label.box.height,
            `"${label.text}" sai por baixo`,
          ).toBeLessThanOrEqual(view.height);
          for (const other of labels.slice(index + 1)) {
            expect(
              overlaps(label.box, other.box),
              `"${label.text}" e "${other.text}" se sobrepõem`,
            ).toBe(false);
          }
        }
      });
    }
  }
});
