import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, overflowX, setDensity, setViewport } from "@/test/geometry";

import { LocalPrescribedRoutineRepository, PRESCRIBED_ROUTINES_STORE } from "../data/prescribed-routine-repository";
import { PrescribedRoutineRepositoryProvider } from "../data/prescribed-routine-repository-context";
import { LocalRestDayRepository, REST_DAYS_STORE } from "../data/rest-day-repository";
import { RestDayRepositoryProvider } from "../data/rest-day-repository-context";
import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import type { PrescribedRoutine } from "../types/prescribed-routine";
import type { RestDay } from "../types/rest-day";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { TodayWorkout } from "./today-workout";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * A sugestão do treino do treinador na tela Hoje (Etapa 8e), medida: nome e
 * treinador longos quebram linha dentro do cartão, nada rola de lado, e
 * "Começar" e "Hoje é descanso" são tocáveis onde são desenhados, sem
 * encavalar.
 */
const WEDNESDAY = "2026-09-30";
const NAME = "Treino A, inferiores com ênfase em posterior de coxa e glúteos";
const PRO = "Rafael Moura de Albuquerque Cavalcanti";
const ROUTINE: PrescribedRoutine = {
  id: "r",
  name: NAME,
  notes: "",
  professionalName: PRO,
  version: 1,
  changeNote: "",
  publishedAt: "2026-09-29T12:00:00Z",
  exercises: [
    {
      id: "e1",
      exerciseId: "cat",
      name: "Agachamento",
      sets: [{ id: "s1", reps: 8, weightKg: 60, rpe: 8, durationSeconds: null }],
      restSeconds: 90,
      notes: "",
    },
  ],
  previous: null,
  weekdays: ["mon", "wed", "fri"],
  linkEnded: false,
  seenVersion: 1,
  createdAt: 1,
  updatedAt: 1,
};

async function mount() {
  const received = new LocalPrescribedRoutineRepository(new MemoryStore<PrescribedRoutine>(PRESCRIBED_ROUTINES_STORE));
  await received.replaceAll([ROUTINE]);
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const routines = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  const rest = new LocalRestDayRepository(new MemoryStore<RestDay>(REST_DAYS_STORE));
  render(
    <main className="px-4 py-4">
      <WorkoutRepositoryProvider repositories={Promise.resolve({ routines, sessions })}>
        <RestDayRepositoryProvider repository={Promise.resolve(rest)}>
          <PrescribedRoutineRepositoryProvider repository={Promise.resolve(received)}>
            <TodayWorkout day={WEDNESDAY} />
          </PrescribedRoutineRepositoryProvider>
        </RestDayRepositoryProvider>
      </WorkoutRepositoryProvider>
    </main>,
  );
}

/** A largura do texto em si: maior que a caixa dele é texto cortado. */
function expectWhole(text: HTMLElement, container: Element) {
  const range = document.createRange();
  range.selectNodeContents(text);
  expect(range.getBoundingClientRect().width, "texto cortado").toBeLessThanOrEqual(text.getBoundingClientRect().width + 0.5);
  expect(text.getBoundingClientRect().right, "texto passa da borda").toBeLessThanOrEqual(container.getBoundingClientRect().right + 0.5);
}

function expectTouchable(control: HTMLElement) {
  control.scrollIntoView({ block: "center" });
  for (const hit of hitTargetsAcross(control)) {
    expect(control.contains(hit), `o toque em "${control.textContent ?? ""}" cai em outro elemento`).toBe(true);
  }
}

const apart = (a: DOMRect, b: DOMRect) =>
  a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;

describe("Hoje: sugestão do treino do treinador", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        await mount();

        const name = await screen.findByText(NAME);
        const card = document.querySelector("main")!;
        expect(overflowX(document.documentElement), "a página rola de lado").toBeLessThanOrEqual(0);
        expectWhole(name, card);
        expectWhole(screen.getByText(new RegExp(`^${PRO} ·`)), card);

        const start = screen.getByRole("button", { name: "Começar" });
        const rest = screen.getByRole("button", { name: "Hoje é descanso" });
        expectTouchable(start);
        expectTouchable(rest);
        expect(apart(start.getBoundingClientRect(), rest.getBoundingClientRect()), "Começar e descanso encavalados").toBe(true);
        cleanup();
      });
    }
  }
});
