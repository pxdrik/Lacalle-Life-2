import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  hitTargetsAcross,
  overflowX,
  setDensity,
  setViewport,
} from "@/test/geometry";

import { LocalRestDayRepository, REST_DAYS_STORE } from "../data/rest-day-repository";
import { RestDayRepositoryProvider } from "../data/rest-day-repository-context";
import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import { createRestDay, type RestDay } from "../types/rest-day";
import type { Session } from "../types/session";
import { TodayWorkout } from "./today-workout";

/**
 * Roadmap 7.5: "Hoje é descanso" entrou ao lado de "Começar treino", no card
 * vazio do Hoje. Dois botões numa linha, a 320px Confortável, é a forma de
 * mudança que já transbordou neste projeto; e os dois são `touch-44`, então
 * o toque de um não pode cair no outro.
 */
const DAY = "2026-09-30";

/** Quantas linhas o texto ocupa: uma caixa por linha, agrupadas pelo topo. */
function textLines(element: Element): number {
  const range = document.createRange();
  const tops = new Set<number>();
  for (const node of element.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE || node.textContent?.trim() === "") continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
  }
  return tops.size;
}

async function mount(restDays: readonly string[] = []) {
  const rest = new LocalRestDayRepository(new MemoryStore<RestDay>(REST_DAYS_STORE));
  for (const day of restDays) await rest.save(createRestDay(day), null);
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const routines = new LocalRoutineRepository(new MemoryStore(ROUTINES_STORE));

  render(
    <main className="px-4 py-4">
      <WorkoutRepositoryProvider repositories={Promise.resolve({ routines, sessions })}>
        <RestDayRepositoryProvider repository={Promise.resolve(rest)}>
          <TodayWorkout day={DAY} />
        </RestDayRepositoryProvider>
      </WorkoutRepositoryProvider>
    </main>,
  );
}

describe("7.5 — card de treino com dia de descanso", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);

        await mount();
        const start = await screen.findByRole("link", { name: "Começar treino" });
        const rest = screen.getByRole("button", { name: "Hoje é descanso" });
        const card = start.closest("section")!;

        expect(overflowX(card)).toBeLessThanOrEqual(0);
        for (const control of [start, rest]) {
          const box = control.getBoundingClientRect();
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth + 1);
          // Texto curto não quebra linha (brandbook).
          expect(textLines(control), `"${control.textContent ?? ""}" quebrou`).toBe(1);
          for (const hit of hitTargetsAcross(control)) {
            expect(control.contains(hit), `toque em "${control.textContent ?? ""}"`).toBe(true);
          }
        }
        cleanup();

        await mount([DAY]);
        const undo = await screen.findByRole("button", { name: "Desfazer" });
        expect(overflowX(undo.closest("section")!)).toBeLessThanOrEqual(0);
        for (const hit of hitTargetsAcross(undo)) {
          expect(undo.contains(hit)).toBe(true);
        }
      });
    }
  }
});
