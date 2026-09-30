import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import {
  LocalRoutineRepository,
  ROUTINES_STORE,
} from "../data/routine-repository";
import {
  LocalRestDayRepository,
  REST_DAYS_STORE,
} from "../data/rest-day-repository";
import { RestDayRepositoryProvider } from "../data/rest-day-repository-context";
import {
  LocalSessionRepository,
  SESSIONS_STORE,
} from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import { createRestDay, type RestDay } from "../types/rest-day";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { TodayWorkout } from "./today-workout";

/**
 * The workout half of the home screen.
 *
 * It owns the whole slot rather than sitting beside the "resume" banner:
 * "nada registrado hoje" printed underneath a workout that is running right
 * now would be the screen contradicting itself.
 */

const TODAY = "2026-08-07";
const at = (day: string, hour: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour).getTime();
};

function session(overrides: Partial<Session> & { id: string }): Session {
  const startedAt = overrides.startedAt ?? at(TODAY, 18);

  return {
    routineId: null,
    name: "Treino A",
    startedAt,
    finishedAt: startedAt + 45 * 60 * 1000,
    createdAt: 1,
    updatedAt: 1,
    exercises: [
      {
        id: "se1",
        exerciseId: "supino-reto-com-barra",
        name: "Supino",
        restSeconds: null,
        notes: "",
        sets: [
          {
            id: "s1",
            reps: 10,
            weightKg: 60,
            rpe: null,
            durationSeconds: null,
            isCompleted: true,
            planned: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function mount(sessions: readonly Session[], restDays: readonly string[] = []) {
  const store = new LocalSessionRepository(
    new MemoryStore<Session>(SESSIONS_STORE),
  );
  const routines = new LocalRoutineRepository(
    new MemoryStore<Routine>(ROUTINES_STORE),
  );

  const rest = new LocalRestDayRepository(new MemoryStore<RestDay>(REST_DAYS_STORE));

  const ready = Promise.all(sessions.map((s) => store.save(s, null)));
  const restReady = Promise.all(restDays.map((day) => rest.save(createRestDay(day), null)));

  render(
    <WorkoutRepositoryProvider
      repositories={ready.then(() => ({ routines, sessions: store }))}
    >
      <RestDayRepositoryProvider repository={restReady.then(() => rest)}>
        <TodayWorkout day={TODAY} />
      </RestDayRepositoryProvider>
    </WorkoutRepositoryProvider>,
  );

  return rest;
}

describe("TodayWorkout", () => {
  it("names the workout finished today", async () => {
    mount([session({ id: "a", name: "Peito e tríceps" })]);

    expect(await screen.findByText("Peito e tríceps")).toBeInTheDocument();
  });

  it("ignores yesterday's, which is not today's answer", async () => {
    mount([
      session({ id: "b", name: "Costas", startedAt: at("2026-08-06", 18) }),
    ]);

    expect(
      await screen.findByText("Nenhum treino registrado."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Costas")).not.toBeInTheDocument();
  });

  it("shows the running workout instead of claiming nothing happened", async () => {
    // `startedAt` precisa ser o relógio real, não `TODAY` (uma data fixa no
    // passado): `InProgressBanner` agora compara o início de uma sessão
    // aberta contra `Date.now()` de verdade para decidir se ela é recente ou
    // antiga (achado de auditoria de design, 02/09/2026), e `TODAY` deixou
    // de ser "hoje" há muito tempo.
    mount([
      session({
        id: "c",
        name: "Pernas",
        finishedAt: null,
        startedAt: Date.now(),
      }),
    ]);

    expect(await screen.findByText("Pernas")).toBeInTheDocument();
    expect(screen.getByText(/Em andamento/)).toBeInTheDocument();
    expect(screen.queryByText("Nenhum treino registrado.")).not.toBeInTheDocument();
  });

  it("offers a way to start when the day is still empty", async () => {
    mount([]);

    expect(
      await screen.findByRole("link", { name: "Começar treino" }),
    ).toBeInTheDocument();
  });

  /**
   * Achado de auditoria externa (27/08/2026): sem `aria-label`, o nome
   * acessível de um treino concluído era a concatenação crua dos três
   * textos visíveis — "Peito e tríceps45:00·600 kg", sem separador nenhum
   * para quem ouve a tela em vez de olhar para ela.
   */
  it("gives the finished-session link a spoken name with real separators", async () => {
    mount([session({ id: "a", name: "Peito e tríceps" })]);

    expect(
      await screen.findByRole("link", {
        name: "Ver treino Peito e tríceps, 45:00, 600 kg movidos",
      }),
    ).toBeInTheDocument();
  });
});

/** Roadmap 7.5 (30/09/2026): dia de descanso, sempre escolhido pela pessoa. */
describe("TodayWorkout — dia de descanso", () => {
  it("nunca marca sozinho: dia vazio oferece, não afirma", async () => {
    mount([]);

    expect(await screen.findByText("Nenhum treino registrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje é descanso" })).toBeInTheDocument();
    expect(screen.queryByText("Dia de descanso.")).not.toBeInTheDocument();
  });

  it("marca, grava, e desfaz apagando o registro", async () => {
    const user = userEvent.setup();
    const rest = mount([]);

    await user.click(await screen.findByRole("button", { name: "Hoje é descanso" }));

    expect(await screen.findByText("Dia de descanso.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Começar treino" })).not.toBeInTheDocument();
    await waitFor(async () => {
      expect(await rest.getByDay(TODAY)).toBeDefined();
    });

    await user.click(screen.getByRole("button", { name: "Desfazer" }));

    expect(await screen.findByText("Nenhum treino registrado.")).toBeInTheDocument();
    await waitFor(async () => {
      expect(await rest.getByDay(TODAY)).toBeUndefined();
    });
  });

  it("abre já marcado quando o dia foi marcado antes", async () => {
    mount([], [TODAY]);

    expect(await screen.findByText("Dia de descanso.")).toBeInTheDocument();
  });

  it("não vale para outro dia", async () => {
    mount([], ["2026-08-06"]);

    expect(await screen.findByText("Nenhum treino registrado.")).toBeInTheDocument();
  });

  it("treino feito vence a marca: mostra o treino", async () => {
    mount([session({ id: "a", name: "Peito e tríceps" })], [TODAY]);

    expect(await screen.findByText("Peito e tríceps")).toBeInTheDocument();
    expect(screen.queryByText("Dia de descanso.")).not.toBeInTheDocument();
  });
});
