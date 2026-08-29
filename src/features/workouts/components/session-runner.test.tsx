import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { ExerciseRepositoryProvider } from "../data/exercise-repository-context";
import { LocalExerciseRepository } from "../data/local-exercise-repository";
import {
  LocalRoutineRepository,
  ROUTINES_STORE,
} from "../data/routine-repository";
import {
  LocalSessionRepository,
  SESSIONS_STORE,
} from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import { EXERCISES_STORE } from "../data/exercise-repository";
import type { Exercise } from "../types/exercise";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { SessionRunner } from "./session-runner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/**
 * Finishing a workout is the one irreversible-feeling tap on the screen: it
 * closes the session and swaps the whole page for a summary. It used to happen
 * on a single tap even at set 1 of 8, from a button that sits in a sticky bar
 * right where a thumb rests while scrolling.
 */

function sessionWith(completed: number, total: number): Session {
  return {
    id: "s1",
    routineId: null,
    name: "Treino A",
    startedAt: Date.now(),
    finishedAt: null,
    createdAt: 1,
    updatedAt: 1,
    exercises: [
      {
        id: "se1",
        exerciseId: "supino-reto-com-barra",
        name: "Supino reto",
        restSeconds: null,
        notes: "",
        sets: Array.from({ length: total }, (_, index) => ({
          id: `set-${String(index)}`,
          reps: 10,
          weightKg: 60,
          rpe: null,
          durationSeconds: null,
          isCompleted: index < completed,
          planned: null,
        })),
      },
    ],
  };
}

function mount(session: Session) {
  const sessions = new LocalSessionRepository(
    new MemoryStore<Session>(SESSIONS_STORE),
  );
  const routines = new LocalRoutineRepository(
    new MemoryStore<Routine>(ROUTINES_STORE),
  );
  const exercises = new LocalExerciseRepository(
    new MemoryStore<Exercise>(EXERCISES_STORE),
  );

  const ready = sessions.save(session, null);

  render(
    <WorkoutRepositoryProvider
      repositories={ready.then(() => ({ routines, sessions }))}
    >
      <ExerciseRepositoryProvider repository={ready.then(() => exercises)}>
        <SessionRunner sessionId={session.id} />
      </ExerciseRepositoryProvider>
    </WorkoutRepositoryProvider>,
  );

  return sessions;
}

const finishButton = () =>
  screen.getByRole("button", { name: /Finalizar|Encerrar/ });

async function waitForRunner() {
  await screen.findByRole("heading", { name: "Treino A" });
}

describe("finishing a workout with sets still open", () => {
  it("does not finish on the first tap", async () => {
    const sessions = mount(sessionWith(1, 8));
    await waitForRunner();

    await userEvent.click(finishButton());

    // Still running: the summary would have replaced the runner entirely.
    expect(await sessions.getById("s1")).toMatchObject({ finishedAt: null });
  });

  it("names what is being given up", async () => {
    // The count lives in the accessible name rather than the visible label,
    // which has ~115px in the sticky bar on a phone.
    mount(sessionWith(1, 8));
    await waitForRunner();

    await userEvent.click(finishButton());

    expect(
      screen.getByRole("button", {
        name: "Encerrar assim? 7 séries ainda pendentes.",
      }),
    ).toBeInTheDocument();
  });

  it("says 'série' in the singular for the last set", async () => {
    mount(sessionWith(7, 8));
    await waitForRunner();

    await userEvent.click(finishButton());

    expect(
      screen.getByRole("button", {
        name: "Encerrar assim? 1 série ainda pendente.",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the visible label inside the accessible name", async () => {
    // WCAG 2.5.3: someone using voice control says what they see, so the
    // accessible name has to contain the visible text.
    mount(sessionWith(1, 8));
    await waitForRunner();

    await userEvent.click(finishButton());

    const button = screen.getByRole("button", { name: /Encerrar assim\?/ });
    expect(button.getAttribute("aria-label")).toContain(
      button.textContent?.trim(),
    );
  });

  it("finishes on the second tap", async () => {
    const sessions = mount(sessionWith(1, 8));
    await waitForRunner();

    await userEvent.click(finishButton());
    await userEvent.click(finishButton());

    await waitFor(async () => {
      expect(await sessions.getById("s1")).not.toMatchObject({
        finishedAt: null,
      });
    });
  });
});

describe("finishing a completed workout", () => {
  it("takes a single tap once every set is done", async () => {
    // The guard exists to catch an accident, and there is no accident left to
    // catch here — asking twice would only be friction.
    const sessions = mount(sessionWith(8, 8));
    await waitForRunner();

    // By name, not by the shared helper: once everything is done the "all
    // sets complete" card appears with a "Finalizar treino" of its own, and
    // this test is about the sticky bar.
    await userEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    await waitFor(async () => {
      expect(await sessions.getById("s1")).not.toMatchObject({
        finishedAt: null,
      });
    });
  });

  /**
   * BUG-017 (auditoria externa, 14/08): "'500 kg movidos' com uma série de
   * 52,5 kg fora da conta" — a frase literal que a auditoria citou, e o texto
   * exato que este cartão mostra. Não basta o número estar certo; alguém
   * completando o treino precisa ver que uma série ficou de fora.
   */
  it("warns when a completed set has a weight but no reps on record", async () => {
    const session = sessionWith(8, 8);
    const withMissingReps: Session = {
      ...session,
      exercises: [
        {
          ...session.exercises[0]!,
          sets: session.exercises[0]!.sets.map((set, index) =>
            index === 0 ? { ...set, reps: null } : set,
          ),
        },
      ],
    };

    mount(withMissingReps);
    await waitForRunner();

    expect(
      screen.getByText(
        "1 série concluída sem repetições registradas não entrou no total.",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing about excluded sets when every completed set counted", async () => {
    mount(sessionWith(8, 8));
    await waitForRunner();

    expect(
      screen.queryByText(/não entrou no total|não entraram no total/),
    ).not.toBeInTheDocument();
  });
});

/**
 * BUG-008 (auditoria externa, 14/08 e fechamento, 15/08): três toques no
 * mesmo quadro do React se anulavam — `apply` lia `state` do closure, então
 * duas chamadas síncronas computavam `next` a partir do mesmo estado antigo,
 * e a segunda `setState` apagava o efeito da primeira antes de qualquer uma
 * chegar ao IndexedDB.
 *
 * `fireEvent`, não `userEvent`: `userEvent.click` insere `await`s internos
 * que já dão ao React uma chance de re-renderizar entre os dois toques —
 * exatamente a janela de tempo que faz o bug desaparecer. O toque humano real
 * também costuma ser lento o bastante para não disparar isto; é por isso que
 * o teste tem de forçar os dois toques no mesmo lote, não confiar em cliques
 * devagar.
 */
/**
 * Achado de auditoria externa (27/08/2026): tocar em concluir numa série sem
 * reps nem peso a marcava concluída na hora, sem nenhum aviso — um treino
 * inteiro podia terminar sem carga real registrada. A confirmação preserva o
 * caso legítimo de aquecimento (BUG-01: "não simplesmente desabilite o
 * botão"), só que agora exige um segundo toque.
 */
describe("completing a set with no reps or weight recorded", () => {
  function sessionWithEmptySet(): Session {
    const session = sessionWith(0, 1);
    return {
      ...session,
      exercises: [
        {
          ...session.exercises[0]!,
          sets: [
            { ...session.exercises[0]!.sets[0]!, reps: null, weightKg: null },
          ],
        },
      ],
    };
  }

  it("asks for confirmation instead of completing right away", async () => {
    const sessions = mount(sessionWithEmptySet());
    await waitForRunner();

    await userEvent.click(
      screen.getByRole("button", { name: "Concluir série 1 de Supino reto" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Concluir série sem registrar carga?",
      }),
    ).toBeInTheDocument();
    // Not completed yet — the confirmation is still open.
    expect((await sessions.getById("s1"))?.exercises[0]?.sets[0]).toMatchObject(
      { isCompleted: false },
    );
  });

  it("does nothing when 'Voltar' is pressed", async () => {
    const sessions = mount(sessionWithEmptySet());
    await waitForRunner();

    await userEvent.click(
      screen.getByRole("button", { name: "Concluir série 1 de Supino reto" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(
      screen.queryByRole("heading", {
        name: "Concluir série sem registrar carga?",
      }),
    ).not.toBeInTheDocument();
    expect((await sessions.getById("s1"))?.exercises[0]?.sets[0]).toMatchObject(
      { isCompleted: false },
    );
  });

  it("completes the set when 'Concluir mesmo assim' is pressed", async () => {
    const sessions = mount(sessionWithEmptySet());
    await waitForRunner();

    await userEvent.click(
      screen.getByRole("button", { name: "Concluir série 1 de Supino reto" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Concluir mesmo assim" }),
    );

    await waitFor(async () => {
      const stored = await sessions.getById("s1");
      expect(stored?.exercises[0]?.sets[0]).toMatchObject({
        isCompleted: true,
        reps: null,
        weightKg: null,
      });
    });
  });

  it("completes directly, without asking, once reps or weight is filled", async () => {
    // sessionWith(0, 8) fills every set with reps:10, weightKg:60 — the
    // ordinary case this confirmation must never get in the way of.
    const sessions = mount(sessionWith(0, 1));
    await waitForRunner();

    await userEvent.click(
      screen.getByRole("button", { name: "Concluir série 1 de Supino reto" }),
    );

    expect(
      screen.queryByRole("heading", {
        name: "Concluir série sem registrar carga?",
      }),
    ).not.toBeInTheDocument();
    await waitFor(async () => {
      expect(
        (await sessions.getById("s1"))?.exercises[0]?.sets[0],
      ).toMatchObject({ isCompleted: true });
    });
  });
});

describe("marking two different sets done in the same React batch", () => {
  it("keeps both edits — neither the UI nor storage drops one", async () => {
    const sessions = mount(sessionWith(0, 8));
    await waitForRunner();

    const setTwo = screen.getByRole("button", {
      name: "Concluir série 2 de Supino reto",
    });
    const setThree = screen.getByRole("button", {
      name: "Concluir série 3 de Supino reto",
    });

    // Both dispatched synchronously, before React has a chance to
    // re-render between them — the same-tick race BUG-008 needs.
    fireEvent.click(setTwo);
    fireEvent.click(setThree);

    // The UI: both toggles must read as completed, not just the second one.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Desmarcar série 2 de Supino reto" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Desmarcar série 3 de Supino reto" }),
      ).toBeInTheDocument();
    });

    // Storage: both writes actually landed, not just whichever raced last.
    await waitFor(async () => {
      const stored = await sessions.getById("s1");
      const sets = stored?.exercises[0]?.sets ?? [];
      expect(sets[1]?.isCompleted).toBe(true);
      expect(sets[2]?.isCompleted).toBe(true);
    });
  });
});
