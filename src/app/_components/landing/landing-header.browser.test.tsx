import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  hitTargetsAcross,
  setDensity,
  setViewport,
} from "@/test/geometry";

import { LandingHeader } from "./landing-header";

/**
 * Roadmap 8.19 (30/09/2026): o cabeçalho da landing fazia a página rolar de
 * lado em 10 das 15 combinações de celular (até 172px em 320px
 * Confortável). É a porta de entrada do app, e também o cabeçalho das
 * páginas legais. 640px entra porque é onde "Criar minha conta" volta.
 */
const TABLET_WIDTH = 640;

describe("8.19 — o cabeçalho da landing cabe", () => {
  for (const width of [...PHONE_WIDTHS, TABLET_WIDTH, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 600);
        setDensity(density);
        render(<LandingHeader />);

        expect(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          "a página rola de lado",
        ).toBeLessThanOrEqual(0);

        const links = [
          screen.getByRole("link", { name: "LaCalle Life" }),
          screen.getByRole("link", { name: "Entrar" }),
        ];
        const signup = screen.queryByRole("link", { name: "Criar minha conta" });
        if (width >= TABLET_WIDTH) {
          expect(signup, "a partir de sm o cadastro volta ao cabeçalho").not.toBeNull();
          links.push(signup!);
        } else {
          // No celular ele está no hero, logo abaixo, como botão principal.
          expect(signup).toBeNull();
        }

        for (const link of links) {
          const box = link.getBoundingClientRect();
          expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth + 0.5);
          for (const hit of hitTargetsAcross(link)) {
            expect(link.contains(hit), `toque em ${link.textContent ?? ""}`).toBe(true);
          }
        }
        cleanup();
      });
    }
  }
});
