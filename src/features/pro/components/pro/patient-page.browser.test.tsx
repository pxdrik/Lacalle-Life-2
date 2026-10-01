import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, setDensity, setViewport } from "@/test/geometry";

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository, patientLink } from "../../data/fake-care-repository.test-helper";
import type { PlanRepository } from "../../data/plan-repository";
import { PlanRepositoryProvider } from "../../data/plan-repository-context";
import type { PlanSummary } from "../../types/plan";
import { PatientPage } from "./patient-page";
import { ProPatients } from "./pro-patients";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pro/pacientes",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/**
 * A página do paciente e a lista que leva até ela (Etapa 5), medidas: nome
 * longo quebra linha, nada rola de lado, e o toque no nome abre o paciente
 * sem cair no "Encerrar" que divide a linha com ele.
 */
const LONG = "Juliana Rocha Albuquerque de Vasconcellos";
const LINKS = [patientLink({ id: "l", label: LONG })];
const NOTE = "Jantar trocado e mais proteína no lanche da tarde, como combinamos na consulta de setembro.";
const PLAN: PlanSummary = {
  id: "p",
  name: "Recomposição corporal com déficit leve e treino de força",
  hasDraft: true,
  versions: [2, 1].map((version) => ({
    version,
    name: "Recomposição",
    changeNote: version === 2 ? NOTE : "",
    publishedAt: "2026-09-26T12:00:00Z",
    meals: [],
  })),
};

function mount(page: React.ReactNode) {
  const plans: PlanRepository = {
    listPlans: () => Promise.resolve([PLAN]),
    createPlan: () => Promise.resolve("p"),
    publish: () => Promise.resolve(3),
  };
  render(
    <ThemeProvider>
      <CareRepositoryProvider repository={fakeCareRepository({ links: LINKS })}>
        <PlanRepositoryProvider repository={plans}>{page}</PlanRepositoryProvider>
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

const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
const WIDTHS = [...PHONE_WIDTHS, DESKTOP_WIDTH, 1600];

describe("página do paciente no Life Pro", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount(<PatientPage linkId="l" />);

        const edit = await screen.findByRole("link", { name: "Editar plano" });
        const note = await screen.findByText(NOTE);
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        // A lista corta o que passa dela (cantos arredondados): a nota e o
        // nome do plano têm que quebrar linha, não sumir na borda.
        for (const text of [note, screen.getByText(PLAN.name)]) {
          const list = text.closest("ul, [class*='rounded']")!;
          expect(textWidth(text), "texto cortado").toBeLessThanOrEqual(text.getBoundingClientRect().width + 0.5);
          expect(text.getBoundingClientRect().right, "texto passa da borda").toBeLessThanOrEqual(list.getBoundingClientRect().right + 0.5);
        }
        const box = edit.getBoundingClientRect();
        expect(box.right, "Editar plano fora da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        for (const hit of hitTargetsAcross(edit)) {
          expect(edit.contains(hit), "toque fora do botão").toBe(true);
        }
        cleanup();
      });
    }
  }
});

describe("Pacientes: o nome abre o paciente", () => {
  for (const width of [320, 390, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount(<ProPatients />);

        const name = await screen.findByText(LONG);
        const open = name.closest("a")!;
        const row = open.closest("li")!;
        const end = within(row).getByRole("button", { name: `Encerrar vínculo com ${LONG}` });
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        for (const hit of hitTargetsAcross(open)) {
          expect(open.contains(hit), "o toque no nome cai em outro controle").toBe(true);
        }
        for (const hit of hitTargetsAcross(end)) {
          expect(end.contains(hit), "o toque no Encerrar cai em outro controle").toBe(true);
        }
        cleanup();
      });
    }
  }
});
