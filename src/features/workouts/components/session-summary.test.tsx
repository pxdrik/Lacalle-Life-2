import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Session } from "../types/session";
import { SessionSummary } from "./session-summary";

/**
 * BUG-017 (auditoria externa, 14/08): a versão permanente do aviso — o
 * relatório que fica depois que a tela de término de `session-runner.tsx`
 * some. Se o número não bate com o que a lista de séries abaixo mostra,
 * quem revisita este relatório precisa da mesma explicação.
 */

function sessionWith(sets: Partial<Session["exercises"][number]["sets"][number]>[]): Session {
  return {
    id: "s1",
    routineId: null,
    name: "Treino A",
    startedAt: Date.now() - 3_600_000,
    finishedAt: Date.now(),
    createdAt: 1,
    updatedAt: 1,
    exercises: [
      {
        id: "se1",
        exerciseId: "supino-reto-com-barra",
        name: "Supino reto",
        restSeconds: null,
        notes: "",
        sets: sets.map((set, index) => ({
          id: `set-${String(index)}`,
          reps: 10,
          weightKg: 60,
          rpe: null,
          isCompleted: true,
          planned: null,
          ...set,
        })),
      },
    ],
  };
}

function mount(session: Session) {
  render(
    <SessionSummary session={session} onEdit={vi.fn()} onDelete={vi.fn()} />,
  );
}

describe("SessionSummary", () => {
  it("says nothing about excluded sets when every completed set counted", () => {
    mount(sessionWith([{ reps: 10, weightKg: 60 }]));

    expect(
      screen.queryByText(/ficou de fora do volume|ficaram de fora do volume/),
    ).not.toBeInTheDocument();
  });

  it("names how many completed sets have a weight but no reps", () => {
    mount(sessionWith([{ reps: 10, weightKg: 60 }, { reps: null, weightKg: 52.5 }]));

    expect(
      screen.getByText(
        "1 série concluída ficou de fora do volume: tem peso registrado, mas sem repetições.",
      ),
    ).toBeInTheDocument();
  });

  it("uses the plural for more than one excluded set", () => {
    mount(
      sessionWith([
        { reps: null, weightKg: 52.5 },
        { reps: null, weightKg: 40 },
      ]),
    );

    expect(
      screen.getByText(
        "2 séries concluídas ficaram de fora do volume: têm peso registrado, mas sem repetições.",
      ),
    ).toBeInTheDocument();
  });

  it("does not warn about a bodyweight set — no weight is an honest, documented exclusion", () => {
    mount(sessionWith([{ reps: 12, weightKg: null }]));

    expect(
      screen.queryByText(/ficou de fora do volume|ficaram de fora do volume/),
    ).not.toBeInTheDocument();
  });

  it("shows a typed but unconfirmed set's values instead of only 'não realizada'", () => {
    // BUG-009 (auditoria externa, 19/08): reps/peso digitados sobrevivem ao
    // Finalizar mesmo sem o check — `isCompleted` só marca a confirmação —
    // mas o resumo lia como "não realizada" e escondia o que a pessoa
    // digitou, como se tivesse sido descartado.
    mount(sessionWith([{ reps: 10, weightKg: 20, isCompleted: false }]));

    expect(screen.getByText(/10 × 20 kg/)).toBeInTheDocument();
    expect(screen.getByText("(não confirmada)")).toBeInTheDocument();
    expect(screen.queryByText("não realizada")).not.toBeInTheDocument();
  });

  it("still says 'não realizada' when a set has nothing typed at all", () => {
    mount(
      sessionWith([
        { reps: null, weightKg: null, isCompleted: false },
      ]),
    );

    expect(screen.getByText("não realizada")).toBeInTheDocument();
  });
});
