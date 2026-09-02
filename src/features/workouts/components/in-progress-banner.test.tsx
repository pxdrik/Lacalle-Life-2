import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { InProgressBanner } from "./in-progress-banner";

const at = (day: string, hour: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour).getTime();
};

function inProgressSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    routineId: null,
    name: "Teste Cardio",
    startedAt: at("2026-09-02", 10),
    finishedAt: null,
    createdAt: 1,
    updatedAt: 1,
    exercises: [
      {
        id: "se1",
        exerciseId: "esteira",
        name: "Esteira",
        restSeconds: null,
        notes: "",
        sets: [
          {
            id: "s1",
            reps: null,
            weightKg: null,
            rpe: null,
            durationSeconds: 40,
            isCompleted: false,
            planned: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function mount(session: Session) {
  const store = new LocalSessionRepository(
    new MemoryStore<Session>(SESSIONS_STORE),
  );
  const routines = new LocalRoutineRepository(
    new MemoryStore<Routine>(ROUTINES_STORE),
  );
  await store.save(session, null);

  render(
    <WorkoutRepositoryProvider
      repositories={Promise.resolve({ routines, sessions: store })}
    >
      <InProgressBanner />
    </WorkoutRepositoryProvider>,
  );

  return store;
}

/**
 * Achado de auditoria de design (02/09/2026): uma sessão aberta há mais de
 * quatro dias aparecia como "Em andamento · começou há 116:42:45" — um
 * cronômetro sem teto — enquanto a mesma rotina, na lista de treinos,
 * aparecia como "nunca executado". As duas frases não se contradizem de
 * fato (uma fala da sessão aberta, a outra só conta sessões finalizadas),
 * mas lidas juntas pareciam um bug. Estes testes cobrem os dois registros
 * (recente e antigo) e a ação que efetivamente resolve uma sessão antiga.
 */
describe("InProgressBanner", () => {
  it("keeps the ticking-clock treatment for a session started today", async () => {
    await mount(
      inProgressSession({
        id: "a",
        startedAt: at("2026-09-02", 10),
      }),
    );

    expect(await screen.findByText("Teste Cardio")).toBeInTheDocument();
    expect(screen.getByText(/começou há/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Continuar/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Encerrar/ }),
    ).not.toBeInTheDocument();
  });

  it("switches a session left open since a previous calendar day to the day-count treatment", async () => {
    await mount(
      inProgressSession({
        id: "b",
        startedAt: at("2026-08-29", 23),
      }),
    );

    expect(await screen.findByText("Teste Cardio")).toBeInTheDocument();
    expect(screen.getByText(/Treino em andamento/)).toBeInTheDocument();
    expect(screen.getByText(/iniciado há \d+ dias?/)).toBeInTheDocument();
    // No raw HH:MM:SS clock for a stale session — that is the exact display
    // the audit flagged as nonsensical past 24 hours.
    expect(screen.queryByText(/começou há/)).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Retomar" }),
    ).toHaveAttribute("href", "/sessao/b");
    expect(
      screen.getByRole("button", { name: /Encerrar/ }),
    ).toBeInTheDocument();
  });

  it("'Encerrar' finishes the session in place, without discarding its sets, and the banner disappears", async () => {
    const store = await mount(
      inProgressSession({
        id: "c",
        startedAt: at("2026-08-20", 9),
      }),
    );

    const end = await screen.findByRole("button", { name: /Encerrar/ });
    fireEvent.click(end);

    await waitFor(async () => {
      const saved = await store.getById("c");
      expect(saved?.finishedAt).not.toBeNull();
    });

    const saved = await store.getById("c");
    // The set the user never marked complete is still there, exactly as
    // planned — finishing a stale session must not quietly delete progress.
    expect(saved?.exercises[0]?.sets).toHaveLength(1);

    await waitFor(() => {
      expect(screen.queryByText("Teste Cardio")).not.toBeInTheDocument();
    });
  });

  it("never shows both 'em andamento' and a raw multi-day stopwatch together", async () => {
    await mount(
      inProgressSession({
        id: "d",
        startedAt: at("2026-08-15", 8),
      }),
    );

    await screen.findByText("Teste Cardio");
    // The old bug: `começou há 116:42:45` — hours past any sane clock
    // reading, on the same card that also claims to be "em andamento".
    expect(screen.queryByText(/começou há \d{3,}:/)).not.toBeInTheDocument();
  });
});
