import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import {
  LocalRoutineRepository,
  ROUTINES_STORE,
} from "../data/routine-repository";
import {
  LocalSessionRepository,
  SESSIONS_STORE,
} from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import type { Session } from "../types/session";
import { EvolutionScreen } from "./evolution-screen";

function finishedSession(): Session {
  const startedAt = new Date(2026, 8, 1, 7).getTime();

  return {
    id: "s1",
    routineId: null,
    name: "Treino A",
    startedAt,
    finishedAt: startedAt + 40 * 60_000,
    createdAt: 1,
    updatedAt: 1,
    exercises: [
      {
        id: "se1",
        exerciseId: "supino-reto-barra",
        name: "Supino Reto com Barra",
        restSeconds: null,
        notes: "",
        sets: [
          {
            id: "set1",
            reps: 8,
            weightKg: 60,
            rpe: null,
            durationSeconds: null,
            isCompleted: true,
            planned: null,
          },
        ],
      },
    ],
  };
}

async function mount() {
  const sessions = new LocalSessionRepository(
    new MemoryStore<Session>(SESSIONS_STORE),
  );
  const routines = new LocalRoutineRepository(new MemoryStore(ROUTINES_STORE));
  await sessions.save(finishedSession(), null);

  render(
    <WorkoutRepositoryProvider
      repositories={Promise.resolve({ routines, sessions })}
    >
      <EvolutionScreen />
    </WorkoutRepositoryProvider>,
  );
}

/**
 * `Tabs` de verdade substituiu os dois `<button aria-pressed>` — este teste
 * é sobre o comportamento continuar o mesmo com o componente novo, não
 * sobre a animação em si (`tokens.test.ts` não cobre motion, e não é o
 * papel deste arquivo cobrir).
 */
describe("a métrica do gráfico (Volume/Duração)", () => {
  it("mostra Volume por padrão, com role de aba de verdade", async () => {
    await mount();

    const volume = await screen.findByRole("tab", { name: "Volume" });
    expect(volume).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Volume semanal")).toBeInTheDocument();
  });

  it("troca para Duração ao clicar na aba", async () => {
    await mount();
    await screen.findByRole("tab", { name: "Volume" });

    await userEvent.click(screen.getByRole("tab", { name: "Duração" }));

    expect(screen.getByRole("tab", { name: "Duração" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Duração semanal")).toBeInTheDocument();
  });
});
