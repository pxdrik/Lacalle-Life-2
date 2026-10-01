import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/design-system/theme/theme-provider";
import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  hitTargetsAcross,
  setDensity,
  setViewport,
} from "@/test/geometry";

import { fakeProRepository, record } from "../../data/fake-pro-repository.test-helper";
import { ProRepositoryProvider } from "../../data/pro-repository-context";
import { AdminApproved } from "./admin-approved";
import { AdminRequests } from "./admin-requests";
import { AdminShell } from "./admin-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

/**
 * Administração (Life Pro, Etapa 2), medida. O Pedro viu linhas sobrepostas
 * num protótipo e pediu o mesmo cuidado das últimas entregas: nada rola de
 * lado, nome longo quebra linha em vez de cortar, cada linha é tocável onde
 * é desenhada, e a folha de conferência cabe com os botões à vista.
 * Também 1440 e 1600: a área de trabalho vai até 1600px (`tokens.css`).
 */
const LONG = "Juliana Rocha Albuquerque de Vasconcellos";
const PEOPLE = [
  record({ userId: "b" }),
  record({ userId: "j", displayName: LONG, email: "juliana.rocha.albuquerque@exemplo.com" }),
];

function mount(page: React.ReactNode, people = PEOPLE) {
  render(
    <ThemeProvider>
      <ProRepositoryProvider repository={fakeProRepository({ access: { isAdmin: true, professional: null }, professionals: people })}>
        <AdminShell>{page}</AdminShell>
      </ProRepositoryProvider>
    </ThemeProvider>,
  );
}

function pageOverflow(): number {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth;
}

function textWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}

const WIDTHS = [...PHONE_WIDTHS, DESKTOP_WIDTH, 1440, 1600];

describe("administração: pedidos e conferência", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount(<AdminRequests />);

        const row = await screen.findByRole("button", { name: `Conferir o pedido de ${LONG}` });
        expect(pageOverflow(), "a página rola de lado").toBeLessThanOrEqual(0);

        // Nome longo inteiro: quebra linha, não corta nem passa da linha.
        const name = within(row).getAllByText(LONG).find((element) => element.getClientRects().length > 0)!;
        expect(textWidth(name), "nome cortado").toBeLessThanOrEqual(name.getBoundingClientRect().width + 0.5);
        expect(name.getBoundingClientRect().right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 0.5);
        for (const hit of hitTargetsAcross(row)) {
          expect(row.contains(hit), "toque fora da linha").toBe(true);
        }

        // A área larga respeita o limite de 1600px.
        const main = document.querySelector("main")!;
        expect(main.getBoundingClientRect().width).toBeLessThanOrEqual(1600 * 1.3);

        // A folha: botões dentro da tela e sem se sobrepor.
        await userEvent.click(row);
        const dialog = await screen.findByRole("dialog");
        const approve = within(dialog).getByRole("button", { name: "Aprovar" });
        const reject = within(dialog).getByRole("button", { name: "Recusar" });
        for (const button of [approve, reject]) {
          const box = button.getBoundingClientRect();
          expect(box.right, "botão fora da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
          expect(box.left).toBeGreaterThanOrEqual(-0.5);
        }
        expect(reject.getBoundingClientRect().right).toBeLessThanOrEqual(approve.getBoundingClientRect().left + 0.5);
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

describe("administração: aprovados", () => {
  for (const width of [320, 390, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount(<AdminApproved />, [record({ userId: "j", displayName: LONG, status: "approved" })]);

        const row = await screen.findByRole("button", { name: `Ver ${LONG}` });
        expect(pageOverflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        const badge = within(row).getByText("Ativo");
        expect(badge.getBoundingClientRect().right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 0.5);
        for (const hit of hitTargetsAcross(row)) {
          expect(row.contains(hit), "toque fora da linha").toBe(true);
        }
        cleanup();
      });
    }
  }
});
