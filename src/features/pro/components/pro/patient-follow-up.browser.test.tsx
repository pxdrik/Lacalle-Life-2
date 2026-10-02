import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pageShell } from "@/design-system/components/page-shell";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, setDensity, setViewport } from "@/test/geometry";

import type { FollowUpRepository } from "../../data/follow-up-repository";
import { FollowUpRepositoryProvider } from "../../data/follow-up-repository-context";
import type { PatientSession } from "../../types/follow-up";
import type { RoutineSummary } from "../../types/routine";
import { PatientBody, PatientDiary, PatientWorkouts } from "./patient-follow-up";

/**
 * O acompanhamento (Etapa 6), medido: os números, a semana, a lista de
 * treinos e o prescrito ao lado do feito não passam da tela nem encavalam;
 * nomes longos quebram linha; cada treino da lista é tocável; o diário rola
 * dentro da própria caixa, nunca a página.
 */
const LONG_ROUTINE = "Treino A, inferiores com ênfase em posterior de coxa e glúteos";
const LONG_EXERCISE = "Agachamento livre com barra e pausa de dois segundos embaixo";
const at = (day: string) => new Date(`${day}T07:10:00`).getTime();
const routine = (id: string, weekdays: RoutineSummary["versions"][number]["weekdays"]): RoutineSummary => ({
  id,
  name: LONG_ROUTINE,
  hasDraft: false,
  versions: [{ version: 1, name: LONG_ROUTINE, changeNote: "", publishedAt: "2026-09-20T12:00:00Z", weekdays }],
});
const session = (id: string, day: string): PatientSession => ({
  id,
  routineId: "ra",
  name: LONG_ROUTINE,
  startedAt: at(day),
  durationMs: 55 * 60_000,
  setsDone: 16,
  setsTotal: 17,
  volumeKg: 12_840,
  exercises: [1, 2].map((n) => ({
    exerciseId: `e${String(n)}`,
    name: LONG_EXERCISE,
    deltaKg: -2.5,
    sets: [0, 1, 2, 3].map((index) => ({
      planned: { weightKg: 102.5, reps: 12, durationSeconds: null },
      done: index === 3 ? null : { weightKg: 107.5, reps: 10, rpe: 9.5, durationSeconds: null },
      warmup: index === 0,
    })),
  })),
});
const repository: FollowUpRepository = {
  listSessions: () => Promise.resolve([session("s1", "2026-10-02"), session("s2", "2026-09-30")]),
  listDiary: () =>
    Promise.resolve({
      planMeals: ["Café da manhã reforçado antes do treino", "Almoço", "Lanche da tarde", "Jantar"].map((name, index) => ({ id: `m${String(index)}`, name })),
      days: [{ day: "2026-10-01", ownDiet: false, meals: { m0: "checked", m1: "edited" }, eatenKcal: 2350 }],
    }),
  listBody: () =>
    Promise.resolve([
      { day: "2026-07-04", weightKg: 71.8, measurements: [{ site: "waist", label: "Cintura", cm: 78 }] },
      { day: "2026-09-26", weightKg: 68.6, measurements: [{ site: "waist", label: "Cintura", cm: 74.5 }, { site: "abdomen", label: "Abdômen", cm: 81 }] },
    ]),
  overview: () => Promise.resolve([]),
};

function mount(node: React.ReactNode) {
  render(
    <main className={pageShell()}>
      <FollowUpRepositoryProvider repository={repository}>{node}</FollowUpRepositoryProvider>
    </main>,
  );
}

function textWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}
function expectWhole(text: Element, container: Element) {
  expect(textWidth(text), "texto cortado").toBeLessThanOrEqual(text.getBoundingClientRect().width + 0.5);
  expect(text.getBoundingClientRect().right, "texto passa da borda").toBeLessThanOrEqual(container.getBoundingClientRect().right + 0.5);
}
function expectTouchable(control: HTMLElement) {
  control.scrollIntoView({ block: "center" });
  for (const hit of hitTargetsAcross(control)) {
    expect(control.contains(hit), "o toque cai em outro elemento").toBe(true);
  }
}
const apart = (a: DOMRect, b: DOMRect) =>
  a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;
const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
const WIDTHS = [...PHONE_WIDTHS, DESKTOP_WIDTH, 1600];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T15:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("aba Treinos do paciente", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount(<PatientWorkouts linkId="l" routines={[routine("ra", ["mon", "wed", "fri"])]} />);

        const main = document.querySelector("main")!;
        const open = await screen.findByRole("button", { expanded: true });
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);

        // Os números: cada um inteiro dentro da tela, sem encavalar.
        const tiles = screen.getByText("Volume da semana").closest("div.grid, [class*='grid']")!;
        for (const label of within(tiles as HTMLElement).getAllByText(/./, { selector: "p" })) {
          expect(label.getBoundingClientRect().right, "número passa da caixa").toBeLessThanOrEqual(tiles.getBoundingClientRect().right + 0.5);
        }

        // A semana: um dia por célula, nome do treino quebrando dentro dela.
        const week = screen.getByRole("heading", { name: "Esta semana" }).closest("section")!;
        const cells = within(week).getAllByRole("listitem");
        for (let i = 1; i < cells.length; i++) {
          expect(apart(cells[i - 1]!.getBoundingClientRect(), cells[i]!.getBoundingClientRect()), "dias encavalados").toBe(true);
        }
        for (const cell of cells) {
          for (const text of cell.children) expectWhole(text, cell);
        }

        // A linha do treino: tocável, nome inteiro.
        expectTouchable(open);
        expect(open.getBoundingClientRect().height, "linha baixa demais para o dedo").toBeGreaterThanOrEqual(43.5);
        expectWhole(within(open).getByText(LONG_ROUTINE), open);

        // O prescrito ao lado do feito: cada série cabe e as colunas não encavalam.
        const [exercise] = screen.getAllByRole("heading", { level: 4, name: LONG_EXERCISE });
        const detail = exercise!.closest("section")!;
        expectWhole(exercise!, detail);
        for (const row of within(detail).getAllByLabelText(/^Série \d/)) {
          expect(row.getBoundingClientRect().right, "série passa do treino").toBeLessThanOrEqual(main.getBoundingClientRect().right + 0.5);
          const boxes = [...row.children].map((cell) => cell.getBoundingClientRect());
          for (let i = 1; i < boxes.length; i++) expect(apart(boxes[i - 1]!, boxes[i]!), "colunas da série encavaladas").toBe(true);
          for (const cell of row.children) expectWhole(cell, cell);
        }
        cleanup();
      });
    }
  }
});

describe("abas Diário e Evolução do paciente", () => {
  for (const width of [320, 390, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount(
          <>
            <PatientDiary linkId="l" plan={{ id: "p", name: "Plano", hasDraft: false, versions: [{ version: 1, name: "Plano", changeNote: "", publishedAt: "2026-09-20T12:00:00Z", meals: [] }] }} />
            <PatientBody linkId="l" />
          </>,
        );

        await screen.findByRole("row", { name: /^Almoço/ });
        await screen.findByRole("row", { name: /^Cintura/ });
        expect(overflow(), "o diário fez a página rolar de lado").toBeLessThanOrEqual(0);
        for (const name of ["Semana anterior", "Próxima semana"]) {
          const button = screen.getByRole("button", { name });
          expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(43.5);
        }
        expectTouchable(screen.getByRole("button", { name: "Semana anterior" }));
        // As tabelas rolam dentro da própria caixa (regra do projeto); a caixa não passa da tela.
        for (const name of [/^Almoço/, /^Cintura/]) {
          const box = screen.getByRole("row", { name }).closest("table")!.parentElement!;
          expect(getComputedStyle(box).overflowX, "tabela sem caixa de rolagem").toBe("auto");
          expect(box.getBoundingClientRect().right, "a caixa da tabela passa da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        }
        cleanup();
      });
    }
  }
});
