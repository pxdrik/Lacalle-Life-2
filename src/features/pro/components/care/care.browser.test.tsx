import { cleanup, render, screen, within } from "@testing-library/react";
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

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository, myLink, patientLink } from "../../data/fake-care-repository.test-helper";
import { fakeProRepository } from "../../data/fake-pro-repository.test-helper";
import { ProRepositoryProvider } from "../../data/pro-repository-context";
import { ProPatients } from "../pro/pro-patients";
import { ProShell } from "../pro/pro-shell";
import { CareSection } from "./care-section";
import { InviteScreen } from "./invite-screen";

vi.mock("next/navigation", () => ({ usePathname: () => "/pro/pacientes" }));

/**
 * Vínculo e convite (Life Pro, Etapa 4), medidos: a página do convite, o
 * "Acompanhamento" no Perfil e Pacientes. Nome longo quebra linha em vez de
 * cortar, nada rola de lado, e cada controle é tocável onde é desenhado,
 * inclusive "Encerrar" ao lado da etiqueta numa linha de 320px.
 */
const LONG = "Juliana Rocha Albuquerque de Vasconcellos";

function overflow(): number {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth;
}

function inside(element: Element, container: Element) {
  const box = element.getBoundingClientRect();
  const outer = container.getBoundingClientRect();
  expect(box.right, `${element.textContent ?? ""} passa da borda`).toBeLessThanOrEqual(outer.right + 0.5);
  expect(box.left).toBeGreaterThanOrEqual(outer.left - 0.5);
}

function providers(children: React.ReactNode, care = fakeCareRepository({})) {
  return (
    <ThemeProvider>
      <ProRepositoryProvider
        repository={fakeProRepository({
          access: {
            isAdmin: false,
            professional: { status: "approved", displayName: LONG, registrations: { crn: { region: "CRN-3", number: "1" }, cref: null }, rejectionReason: null },
          },
        })}
      >
        <CareRepositoryProvider repository={care}>{children}</CareRepositoryProvider>
      </ProRepositoryProvider>
    </ThemeProvider>
  );
}

for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
  for (const density of DENSITIES) {
    describe(`${String(width)}px, ${density}`, () => {
      it("convite: quem convidou e as opções cabem", async () => {
        await setViewport(width, 900);
        setDensity(density);
        render(
          <main className="px-4">
            {providers(
              <InviteScreen token="tok" />,
              fakeCareRepository({ invite: { state: "valid", professionalName: LONG, council: "CRN-3 12345", isOwn: false } }),
            )}
          </main>,
        );
        const accept = await screen.findByRole("button", { name: "Aceitar" });
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        const main = document.querySelector("main")!;
        inside(screen.getByText(LONG), main);
        for (const label of ["Diário alimentar", "Evolução física", "Dados do perfil"]) {
          const box = screen.getByLabelText(new RegExp(label));
          for (const hit of hitTargetsAcross(box)) {
            expect(box.closest("label")!.contains(hit), `toque em ${label}`).toBe(true);
          }
        }
        inside(accept, main);
        cleanup();
      });

      it("Acompanhamento: botões lado a lado sem se sobrepor", async () => {
        await setViewport(width, 900);
        setDensity(density);
        render(<main className="px-4">{providers(<CareSection />, fakeCareRepository({ myLinks: [myLink({ linkId: "l1", professionalName: LONG })] }))}</main>);
        const change = await screen.findByRole("button", { name: "Mudar o que ela vê" });
        const end = screen.getByRole("button", { name: `Encerrar acompanhamento com ${LONG}` });
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        const main = document.querySelector("main")!;
        inside(change, main);
        inside(end, main);
        for (const button of [change, end]) {
          for (const hit of hitTargetsAcross(button)) {
            expect(button.contains(hit), `toque em ${button.textContent ?? ""}`).toBe(true);
          }
        }
        cleanup();
      });

      it("Pacientes: etiqueta e botão sem se sobrepor, tocáveis", async () => {
        await setViewport(width, 900);
        setDensity(density);
        render(
          providers(
            <ProShell>
              <ProPatients />
            </ProShell>,
            fakeCareRepository({
              links: [patientLink({ id: "l1", label: LONG })],
              invites: [{ id: "i1", label: LONG, createdAt: "2026-09-26T12:00:00.000Z", expiresAt: "2099-10-03T12:00:00.000Z" }],
            }),
          ),
        );
        const end = await screen.findByRole("button", { name: `Encerrar vínculo com ${LONG}` });
        const cancel = screen.getByRole("button", { name: "Cancelar" });
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        for (const button of [end, cancel]) {
          const row = button.closest("li")!;
          // Fora da área visível `elementFromPoint` não acha nada; a medida é
          // de onde o botão está, não de onde a janela de teste termina.
          button.scrollIntoView({ block: "center" });
          inside(button, row);
          for (const hit of hitTargetsAcross(button)) {
            expect(button.contains(hit), `toque em ${button.textContent ?? ""}`).toBe(true);
          }
          const badge = within(row).getAllByText(/Ativo|Convite/)[0]!.getBoundingClientRect();
          const box = button.getBoundingClientRect();
          const apart =
            badge.right <= box.left + 0.5 || badge.bottom <= box.top + 0.5 || badge.left >= box.right - 0.5 || badge.top >= box.bottom - 0.5;
          expect(apart, "etiqueta por cima do botão").toBe(true);
        }
        cleanup();
      });
    });
  }
}
