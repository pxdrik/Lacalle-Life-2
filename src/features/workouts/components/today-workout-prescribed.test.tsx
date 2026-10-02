import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { LocalPrescribedRoutineRepository, PRESCRIBED_ROUTINES_STORE } from "../data/prescribed-routine-repository";
import { PrescribedRoutineRepositoryProvider } from "../data/prescribed-routine-repository-context";
import { LocalRestDayRepository, REST_DAYS_STORE } from "../data/rest-day-repository";
import { RestDayRepositoryProvider } from "../data/rest-day-repository-context";
import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import { startSession } from "../services/start-session";
import type { Weekday } from "@/core/domain/weekday";
import type { PrescribedRoutine } from "../types/prescribed-routine";
import { createRestDay, type RestDay } from "../types/rest-day";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { TodayWorkout } from "./today-workout";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

/**
 * O treino do treinador na tela Hoje (Life Pro, Etapa 8e): no dia dele, Hoje
 * sugere e "Começar" inicia esse treino; nos outros dias, só diz quando ele
 * é. Treino em andamento, treino feito e descanso marcado continuam vencendo,
 * e acompanhamento encerrado sai do dia.
 */
const FRIDAY = "2026-08-07";

const routine = (weekdays: Weekday[], overrides: Partial<PrescribedRoutine> = {}): PrescribedRoutine => ({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Treino A, inferiores",
  notes: "",
  professionalName: "Rafael Moura",
  version: 1,
  changeNote: "",
  publishedAt: "2026-08-01T12:00:00Z",
  exercises: [
    {
      id: "e1",
      exerciseId: "cat-agachamento",
      name: "Agachamento livre com barra",
      sets: [{ id: "s1", reps: 8, weightKg: 60, rpe: 8, durationSeconds: null }],
      restSeconds: 90,
      notes: "",
    },
  ],
  previous: null,
  weekdays,
  linkEnded: false,
  seenVersion: 1,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

async function mount(prescribed: readonly PrescribedRoutine[], options: { rest?: boolean; finished?: boolean } = {}) {
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const routines = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  const rest = new LocalRestDayRepository(new MemoryStore<RestDay>(REST_DAYS_STORE));
  const received = new LocalPrescribedRoutineRepository(new MemoryStore<PrescribedRoutine>(PRESCRIBED_ROUTINES_STORE));
  await received.replaceAll(prescribed);
  if (options.rest === true) await rest.save(createRestDay(FRIDAY), null);
  if (options.finished === true) {
    const startedAt = new Date(2026, 7, 7, 7).getTime();
    const done = { ...startSession({ id: "own", name: "Corrida", notes: "", exercises: [], createdAt: 1, updatedAt: 1 }, startedAt) };
    await sessions.save({ ...done, finishedAt: startedAt + 30 * 60 * 1000 }, null);
  }

  render(
    <WorkoutRepositoryProvider repositories={Promise.resolve({ routines, sessions })}>
      <RestDayRepositoryProvider repository={Promise.resolve(rest)}>
        <PrescribedRoutineRepositoryProvider repository={Promise.resolve(received)}>
          <TodayWorkout day={FRIDAY} />
        </PrescribedRoutineRepositoryProvider>
      </RestDayRepositoryProvider>
    </WorkoutRepositoryProvider>,
  );
  return { sessions };
}

describe("Hoje: o treino do treinador", () => {
  it("no dia dele, sugere, e Começar inicia esse treino como uma sessão da pessoa", async () => {
    push.mockClear();
    const { sessions } = await mount([routine(["mon", "fri"])]);

    expect(await screen.findByText("Treino de hoje · do seu treinador")).toBeInTheDocument();
    expect(screen.getByText("Treino A, inferiores")).toBeInTheDocument();
    expect(screen.getByText("Rafael Moura · 1 exercício · 1 série")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje é descanso" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Começar" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    const [session] = await sessions.listAll();
    expect(session).toMatchObject({ routineId: "22222222-2222-4222-8222-222222222222", finishedAt: null });
    expect(push).toHaveBeenCalledWith(`/sessao/${session!.id}`);
  });

  it("noutro dia, não sugere: só diz quando o treino é", async () => {
    await mount([routine(["mon", "wed"])]);

    expect(await screen.findByText("Nenhum treino registrado.")).toBeInTheDocument();
    expect(screen.getByText("O treino do seu treinador é em Seg, Qua.")).toBeInTheDocument();
    expect(screen.queryByText("Treino de hoje · do seu treinador")).toBeNull();
  });

  it("sem dias, o treino fica para quando a pessoa quiser", async () => {
    await mount([routine([])]);

    expect(await screen.findByText("O treino do seu treinador está em Treinos, para quando você quiser.")).toBeInTheDocument();
    expect(screen.queryByText("Treino de hoje · do seu treinador")).toBeNull();
  });

  it("acompanhamento encerrado sai do dia", async () => {
    await mount([routine(["fri"], { linkEnded: true })]);

    expect(await screen.findByText("Nenhum treino registrado.")).toBeInTheDocument();
    expect(screen.getByText("Ao finalizar, volume e duração aparecem aqui.")).toBeInTheDocument();
    expect(screen.queryByText(/do seu treinador/)).toBeNull();
  });

  it("descanso marcado vence a sugestão", async () => {
    await mount([routine(["fri"])], { rest: true });

    expect(await screen.findByText("Dia de descanso.")).toBeInTheDocument();
    expect(screen.queryByText("Treino de hoje · do seu treinador")).toBeNull();
  });

  it("treino feito hoje vence a sugestão", async () => {
    await mount([routine(["fri"])], { finished: true });

    expect(await screen.findByText("Corrida")).toBeInTheDocument();
    expect(screen.queryByText("Treino de hoje · do seu treinador")).toBeNull();
  });
});
