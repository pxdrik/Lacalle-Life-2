import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { DENSITIES, PHONE_WIDTHS, setDensity, setViewport } from "@/test/geometry";

import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import type { Session } from "../types/session";
import { ExerciseHistory } from "./exercise-history";

/**
 * Brandbook, "Texto curto não quebra linha" (Pedro, 30/09/2026): os rótulos
 * das métricas do histórico cabem numa linha em toda largura e densidade.
 * Nasceu de "Série mais pesada (kg × reps)", que quebrava em duas.
 */
describe("Seu histórico — rótulos numa linha só", () => {
  const startedAt = new Date(2026, 8, 1, 7).getTime();
  const SESSION: Session = {
    id: "s1",
    routineId: null,
    name: "Push",
    startedAt,
    finishedAt: startedAt + 3_600_000,
    exercises: [
      {
        id: "e1",
        exerciseId: "supino",
        name: "Supino",
        restSeconds: null,
        notes: "",
        sets: [
          { id: "a", reps: 8, weightKg: 60, rpe: null, durationSeconds: null, isCompleted: true, planned: null },
        ],
      },
    ],
    createdAt: startedAt,
    updatedAt: startedAt,
  };

  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width);
        setDensity(density);
        const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
        const routines = new LocalRoutineRepository(new MemoryStore(ROUTINES_STORE));
        await sessions.save(SESSION, null);
        render(
          <main className="px-4 py-4">
            <WorkoutRepositoryProvider repositories={Promise.resolve({ routines, sessions })}>
              <ExerciseHistory exerciseId="supino" />
            </WorkoutRepositoryProvider>
          </main>,
        );

        for (const text of ["Série mais pesada", "1RM estimado"]) {
          // Pelo começo do texto: o teste tem que medir a quebra, não falhar
          // por não achar um rótulo que mudou de tamanho.
          const label = await screen.findByText(
            (_, element) =>
              element?.tagName === "P" && (element.textContent ?? "").startsWith(text),
          );
          const lineHeight = parseFloat(getComputedStyle(label).lineHeight);
          expect(label.getBoundingClientRect().height, text).toBeLessThan(lineHeight * 1.5);
        }
      });
    }
  }
});
