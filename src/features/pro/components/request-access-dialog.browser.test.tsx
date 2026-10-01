import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, setDensity, setViewport } from "@/test/geometry";

import { RequestAccessDialog } from "./request-access-dialog";

/**
 * O pedido de acesso no Perfil, medido: em cada registro (CREF e CRN, 0037),
 * número e região dividem uma linha, e em 320px Confortável é onde um rótulo
 * poderia passar por cima do vizinho ou a folha rolar de lado. Aberto com os
 * dois registros, o caso mais cheio.
 */
const BOTH = {
  displayName: "Rafael Moura",
  registrations: { crn: { region: "CRN-3", number: "00001" }, cref: { number: "012345-G", region: "SP" } },
};
const PAIRS = [
  ["Número do CREF", "UF"],
  ["Número do CRN", "Região"],
] as const;
describe("pedido de acesso ao Life Pro", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        render(<RequestAccessDialog open initial={BOTH} onClose={vi.fn()} onSubmit={vi.fn()} />);

        const dialog = await screen.findByRole("dialog");
        for (const [numberLabel, regionLabel] of PAIRS) {
          const numberBox = screen.getByLabelText(numberLabel).getBoundingClientRect();
          const regionBox = screen.getByLabelText(regionLabel).getBoundingClientRect();
          // Lado a lado ou um embaixo do outro (estreito, a caixa empilha), nunca encavalados.
          const apart = numberBox.right <= regionBox.left + 0.5 || numberBox.bottom <= regionBox.top + 0.5;
          expect(apart, `${numberLabel} por cima de ${regionLabel}`).toBe(true);
          expect(numberBox.width, `${numberLabel} espremido`).toBeGreaterThanOrEqual(80);
          expect(regionBox.right).toBeLessThanOrEqual(dialog.getBoundingClientRect().right + 0.5);
        }

        for (const label of PAIRS.flat()) {
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
