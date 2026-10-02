import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { pageShell } from "@/design-system/components/page-shell";
import { ToastProvider } from "@/design-system/components/toast";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, setDensity, setViewport } from "@/test/geometry";

import { EXERCISES_STORE } from "../data/exercise-repository";
import { ExerciseRepositoryProvider } from "../data/exercise-repository-context";
import { LocalExerciseRepository } from "../data/local-exercise-repository";
import { LocalPrescribedRoutineRepository, PRESCRIBED_ROUTINES_STORE } from "../data/prescribed-routine-repository";
import { PrescribedRoutineRepositoryProvider } from "../data/prescribed-routine-repository-context";
import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import { createRoutine } from "../services/create-routine";
import type { Exercise } from "../types/exercise";
import type { PrescribedRoutine } from "../types/prescribed-routine";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { PrescribedRoutineScreen } from "./prescribed-routine-screen";
import { RoutineList } from "./routine-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * O treino do treinador no app do paciente (Life Pro, Etapa 8d), medido: em
 * Treinos e na tela de leitura, nome, treinador e observação longos quebram
 * linha em vez de sumir na borda, nada rola de lado, os dias não encavalam
 * com Iniciar e a cópia, e cada botão é tocável onde é desenhado.
 */
const NAME = "Treino A, inferiores com ênfase em posterior de coxa e glúteos";
const PRO = "Rafael Moura de Albuquerque Cavalcanti";
const NOTE = "Desça até a coxa ficar paralela ao chão. Pare se doer o joelho, e avise na próxima consulta.";
const ROUTINE: PrescribedRoutine = {
  id: "r",
  name: NAME,
  notes: "",
  professionalName: PRO,
  version: 12,
  changeNote: "",
  publishedAt: "2026-09-30T12:00:00Z",
  exercises: ["Agachamento livre com barra e pausa de dois segundos", "Leg press 45°"].map((name, index) => ({
    id: `e${String(index)}`,
    exerciseId: `cat${String(index)}`,
    name,
    sets: [1, 2, 3].map((n) => ({ id: `s${String(index)}${String(n)}`, reps: 12, weightKg: 102.5, rpe: 8.5, durationSeconds: null })),
    restSeconds: 120,
    notes: NOTE,
  })),
  previous: null,
  weekdays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  linkEnded: false,
  seenVersion: 12,
  createdAt: 1,
  updatedAt: 1,
};

async function mount(page: React.ReactNode) {
  const routines = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  await routines.save(createRoutine("Mobilidade"), null);
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const prescribed = new LocalPrescribedRoutineRepository(new MemoryStore<PrescribedRoutine>(PRESCRIBED_ROUTINES_STORE));
  await prescribed.replaceAll([ROUTINE]);
  const exercises = new LocalExerciseRepository(new MemoryStore<Exercise>(EXERCISES_STORE));
  render(
    <ToastProvider>
      <main className={pageShell()}>
        <WorkoutRepositoryProvider repositories={Promise.resolve({ routines, sessions })}>
          <ExerciseRepositoryProvider repository={Promise.resolve(exercises)}>
            <PrescribedRoutineRepositoryProvider repository={Promise.resolve(prescribed)}>{page}</PrescribedRoutineRepositoryProvider>
          </ExerciseRepositoryProvider>
        </WorkoutRepositoryProvider>
      </main>
    </ToastProvider>,
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

/** Rola até o controle antes: fora da tela, `elementFromPoint` não acha nada. */
function expectTouchable(control: HTMLElement) {
  control.scrollIntoView({ block: "center" });
  for (const hit of hitTargetsAcross(control)) {
    expect(control.contains(hit), `o toque em "${control.getAttribute("aria-label") ?? control.textContent ?? ""}" cai em outro elemento`).toBe(true);
  }
}

const apart = (a: DOMRect, b: DOMRect) =>
  a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;
const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
const WIDTHS = [...PHONE_WIDTHS, DESKTOP_WIDTH];

describe("Treinos: do seu treinador", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        await mount(<RoutineList />);

        const name = await screen.findByText(NAME);
        const card = name.closest("li")!;
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        expectWhole(name, card);
        expectWhole(within(card).getByText(new RegExp(`${PRO} · versão 12`)), card);
        const badge = within(card).getByText("Profissional");
        expect(badge.getBoundingClientRect().right).toBeLessThanOrEqual(card.getBoundingClientRect().right + 0.5);

        const days = within(card).getByText("Dias do treino:").parentElement!;
        const start = within(card).getByRole("button", { name: `Iniciar ${NAME}` });
        const copy = within(card).getByRole("button", { name: `Fazer uma cópia de ${NAME}` });
        expectWhole(days, card);
        // Só o texto visível (o `sr-only` ao lado tem caixa de 1px): os dias
        // não podem virar uma coluna, um por linha.
        const visible = document.createRange();
        visible.selectNodeContents(days.lastChild!);
        const lines = new Set([...visible.getClientRects()].map((rect) => Math.round(rect.top))).size;
        expect(lines, "dias espremidos, um por linha").toBeLessThanOrEqual(2);
        expectTouchable(start);
        expectTouchable(copy);
        for (const control of [start, copy]) {
          expect(apart(days.getBoundingClientRect(), control.getBoundingClientRect()), "dias e botão encavalados").toBe(true);
          expect(control.getBoundingClientRect().height, "botão baixo demais para o dedo").toBeGreaterThanOrEqual(43.5);
        }
        expect(apart(start.getBoundingClientRect(), copy.getBoundingClientRect()), "Iniciar e cópia encavalados").toBe(true);

        // "Seus treinos" vem depois, com os treinos da pessoa embaixo.
        const own = await screen.findByText("Mobilidade");
        const heading = screen.getByRole("heading", { name: "Seus treinos" });
        expect(heading.getBoundingClientRect().top).toBeGreaterThanOrEqual(card.getBoundingClientRect().bottom);
        expect(own.getBoundingClientRect().top).toBeGreaterThanOrEqual(heading.getBoundingClientRect().bottom);
        cleanup();
      });
    }
  }
});

describe("o treino aberto para leitura", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        await mount(<PrescribedRoutineScreen routineId="r" />);

        const heading = await screen.findByRole("heading", { level: 1, name: NAME });
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        const main = document.querySelector("main")!;
        expectWhole(heading, main);
        expectWhole(screen.getByText(new RegExp(`${PRO} · versão 12`)), main);

        const [note] = screen.getAllByText(NOTE);
        const exercise = note!.closest("li")!;
        expectWhole(note!, exercise);
        // Cada série cabe no cartão, e os números não encavalam entre si.
        for (const row of within(exercise).getAllByLabelText(/^Série \d/)) {
          expect(row.getBoundingClientRect().right, "série passa do cartão").toBeLessThanOrEqual(exercise.getBoundingClientRect().right + 0.5);
          const cells = [...row.children].map((cell) => cell.getBoundingClientRect());
          for (let i = 1; i < cells.length; i++) {
            expect(apart(cells[i - 1]!, cells[i]!), "números da série encavalados").toBe(true);
          }
          for (const cell of row.children) expectWhole(cell as HTMLElement, cell);
        }

        expectTouchable(screen.getByRole("button", { name: "Iniciar treino" }));
        expectTouchable(screen.getByRole("button", { name: "Fazer uma cópia" }));
        cleanup();
      });
    }
  }
});
