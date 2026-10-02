import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, setDensity, setViewport } from "@/test/geometry";

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository, patientLink } from "../../data/fake-care-repository.test-helper";
import type { PlanTemplate, TemplateRepository } from "../../data/template-repository";
import { TemplateRepositoryProvider } from "../../data/template-repository-context";
import { ProLibrary } from "./pro-library";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pro/biblioteca",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/**
 * A Biblioteca (Etapa 5d), medida: nome de modelo longo quebra linha, nada
 * rola de lado, os cartões não encavalam, Apagar e "Usar em paciente" são
 * tocáveis onde aparecem e não se cobrem, e o diálogo cabe com nome longo de
 * paciente.
 */
const LONG = "Recomposição corporal com déficit leve, vegetariano e com lanche pré-treino";
const PATIENT = "Juliana Rocha Albuquerque de Vasconcellos";
const TEMPLATES: PlanTemplate[] = [LONG, "Hipertrofia", "Low carb flexível", "Manutenção"].map((name, index) => ({
  id: `t${String(index)}`,
  name,
  mealCount: 6,
  kcal: 2850,
  updatedAt: "2026-10-01T12:00:00Z",
}));

function mount() {
  const templates: TemplateRepository = {
    listTemplates: () => Promise.resolve(TEMPLATES),
    createTemplate: () => Promise.resolve("t"),
    deleteTemplate: () => Promise.resolve(),
    applyToPatient: () => new Promise<string>(() => undefined),
  };
  render(
    <ThemeProvider>
      <CareRepositoryProvider repository={fakeCareRepository({ links: [patientLink({ id: "l", label: PATIENT })] })}>
        <TemplateRepositoryProvider repository={templates}>
          <ProLibrary />
        </TemplateRepositoryProvider>
      </CareRepositoryProvider>
    </ThemeProvider>,
  );
}

/** A largura do texto em si: maior que a caixa dele é texto cortado. */
function textWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}

function expectWhole(text: HTMLElement, container: Element) {
  expect(textWidth(text), "texto cortado").toBeLessThanOrEqual(text.getBoundingClientRect().width + 0.5);
  expect(text.getBoundingClientRect().right, "texto passa da borda").toBeLessThanOrEqual(container.getBoundingClientRect().right + 0.5);
}

function expectTouchable(control: HTMLElement) {
  control.scrollIntoView({ block: "center" });
  expect(control.getBoundingClientRect().right, "controle fora da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
  for (const hit of hitTargetsAcross(control)) {
    expect(control.contains(hit), `o toque em "${control.textContent ?? ""}" cai em outro elemento`).toBe(true);
  }
}

const apart = (a: DOMRect, b: DOMRect) =>
  a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;
const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
const WIDTHS = [...PHONE_WIDTHS, DESKTOP_WIDTH, 1600];

describe("Biblioteca do Life Pro", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount();

        const name = await screen.findByRole("heading", { name: LONG });
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        // O título não passa por baixo de "Novo modelo" (visto em 390px).
        const title = screen.getByRole("heading", { level: 1, name: "Biblioteca" });
        const create = screen.getByRole("button", { name: "Novo modelo" });
        expectWhole(title, title);
        expect(apart(title.getBoundingClientRect(), create.getBoundingClientRect()), "título e Novo modelo encavalados").toBe(true);
        expectTouchable(create);
        const cards = screen.getAllByRole("listitem");
        const card = name.closest("li")!;
        expectWhole(name, card);
        expectWhole(within(card).getByText("6 refeições · 2.850 kcal"), card);
        for (let i = 1; i < cards.length; i++) {
          expect(apart(cards[i - 1]!.getBoundingClientRect(), cards[i]!.getBoundingClientRect()), "cartões encavalados").toBe(true);
        }

        const remove = within(card).getByRole("button", { name: `Apagar ${LONG}` });
        const apply = within(card).getByRole("button", { name: "Usar em paciente" });
        for (const control of [remove, apply]) {
          expectTouchable(control);
          expect(control.getBoundingClientRect().right, "botão passa do cartão").toBeLessThanOrEqual(card.getBoundingClientRect().right + 0.5);
        }
        expect(apart(remove.getBoundingClientRect(), apply.getBoundingClientRect()), "Apagar e Usar encavalados").toBe(true);
        // Os dois na mesma linha: "Usar em paciente" sozinho embaixo era o
        // rodapé quebrado (visto na captura em 1280px, três colunas).
        // Pelo centro: a lixeira (44px) e o botão têm alturas diferentes.
        const middle = (box: DOMRect) => box.top + box.height / 2;
        expect(Math.abs(middle(remove.getBoundingClientRect()) - middle(apply.getBoundingClientRect())), "rodapé quebrou em duas linhas").toBeLessThanOrEqual(1);
        expectTouchable(within(card).getByRole("link"));

        await userEvent.click(apply);
        const dialog = await screen.findByRole("dialog");
        await Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished));
        expect(dialog.getBoundingClientRect().right, "o diálogo passa da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        const choose = await within(dialog).findByRole("button", { name: new RegExp(PATIENT) });
        expectWhole(within(choose).getByText(PATIENT), choose);
        expectTouchable(choose);
        cleanup();
      });
    }
  }
});
