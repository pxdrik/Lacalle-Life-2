import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, setDensity, setViewport } from "@/test/geometry";

import { RequestAccessDialog } from "./request-access-dialog";

/**
 * O pedido de acesso no Perfil, medido: número do CRN e região dividem uma
 * linha, e em 320px Confortável é onde um rótulo poderia passar por cima do
 * vizinho ou a folha rolar de lado.
 */
describe("pedido de acesso ao Life Pro", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        render(<RequestAccessDialog open initial={null} onClose={vi.fn()} onSubmit={vi.fn()} />);

        const dialog = await screen.findByRole("dialog");
        const number = screen.getByLabelText("Número do CRN");
        const region = screen.getByLabelText("Região");
        const numberBox = number.getBoundingClientRect();
        const regionBox = region.getBoundingClientRect();
        expect(numberBox.right, "número por cima da região").toBeLessThanOrEqual(regionBox.left + 0.5);
        expect(numberBox.width, "campo do número espremido").toBeGreaterThanOrEqual(80);
        expect(regionBox.right).toBeLessThanOrEqual(dialog.getBoundingClientRect().right + 0.5);

        for (const label of ["Número do CRN", "Região"]) {
          const text = screen.getByText(label);
          const range = document.createRange();
          range.selectNodeContents(text);
          expect(range.getBoundingClientRect().width, `"${label}" cortado`).toBeLessThanOrEqual(
            text.getBoundingClientRect().width + 0.5,
          );
        }
        for (const scroller of [dialog, ...dialog.querySelectorAll<HTMLElement>("*")]) {
          const before = scroller.scrollLeft;
          scroller.scrollLeft = 50;
          expect(scroller.scrollLeft, "a folha rola de lado").toBe(before);
          scroller.scrollLeft = before;
        }
        cleanup();
      });
    }
  }
});
