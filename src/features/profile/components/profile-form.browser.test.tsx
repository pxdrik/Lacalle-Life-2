import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pageShell } from "@/design-system/components/page-shell";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, setDensity, setViewport } from "@/test/geometry";

import { ProfileForm } from "./profile-form";

/**
 * "Gordura corporal (%)" e "Ritmo (kg/semana)" lado a lado (relatado pelo
 * Pedro em 02/10/2026): no celular o primeiro rótulo quebra em duas linhas, e
 * o campo dele descia, torto ao lado do outro. Os dois campos têm de começar
 * na mesma altura, em toda largura e densidade, com os rótulos inteiros.
 */
function textWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}

// O celular do Pedro mostra a letra maior (ajuste de fonte do Android, que o
// WebView aplica a todo texto): é aí que o rótulo quebra. Sem simular isso,
// aqui ele cabe numa linha e o teste passava sem a correção (visto).
const ANDROID_TEXT = "main label, main p { font-size: 15.6px !important; letter-spacing: 0.02em; }";

describe("Opcional: os dois campos alinhados", () => {
  for (const [scale, css] of [["fonte normal", ""], ["fonte do Android maior", ANDROID_TEXT]] as const)
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${scale}, ${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        const style = document.createElement("style");
        style.textContent = css;
        document.head.append(style);
        render(
          <main className={pageShell()}>
            <ProfileForm initial={null} pending={false} onSubmit={vi.fn()} />
          </main>,
        );

        const fat = screen.getByLabelText("Gordura corporal (%)");
        const rate = screen.getByLabelText("Ritmo (kg/semana)");
        const a = fat.getBoundingClientRect();
        const b = rate.getBoundingClientRect();
        expect(Math.abs(a.top - b.top), "campos em alturas diferentes").toBeLessThanOrEqual(0.5);
        expect(Math.abs(a.height - b.height), "campos de alturas diferentes").toBeLessThanOrEqual(0.5);
        expect(a.right, "campos encavalados").toBeLessThanOrEqual(b.left);

        for (const label of [screen.getByText("Gordura corporal (%)"), screen.getByText("Ritmo (kg/semana)")]) {
          expect(textWidth(label), "rótulo cortado").toBeLessThanOrEqual(label.getBoundingClientRect().width + 0.5);
          expect(label.getBoundingClientRect().bottom, "rótulo por cima do campo").toBeLessThanOrEqual(a.top + 0.5);
        }
        style.remove();
        cleanup();
      });
    }
  }
});
