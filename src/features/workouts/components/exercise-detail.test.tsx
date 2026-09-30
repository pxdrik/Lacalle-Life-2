import { render as rtlRender, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import type { Exercise } from "../types/exercise";
import type { Session } from "../types/session";
import { ExerciseDetail } from "./exercise-detail";

/**
 * O detalhe mostra o histórico do exercício (roadmap 7.4), que lê os treinos
 * salvos: monta dentro do mesmo provedor que toda tela que abre o detalhe
 * usa. Sem treinos por padrão, então os testes da ficha continuam iguais.
 */
function render(ui: React.ReactElement, saved: readonly Session[] = []) {
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const routines = new LocalRoutineRepository(new MemoryStore(ROUTINES_STORE));
  const ready = Promise.all(saved.map((session) => sessions.save(session, null)));
  const repositories = ready.then(() => ({ routines, sessions }));
  // `wrapper`, não embrulhar à mão: o `rerender` dos testes abaixo troca
  // só o componente e mantém o provedor.
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <WorkoutRepositoryProvider repositories={repositories}>{children}</WorkoutRepositoryProvider>
    ),
  });
}

/** jsdom has no `matchMedia`; the photo viewer asks it about reduced motion. */
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "supino-reto-barra",
    name: "Supino Reto com Barra",
    aliases: [],
    primaryMuscles: ["chest"],
    secondaryMuscles: [],
    stabilizerMuscles: [],
    equipment: ["barbell"],
    movementPattern: null,
    movementPlanes: [],
    technicalDifficulty: null,
    isUnilateral: null,
    isCompound: null,
    media: null,
    classification: "catalogue",
    isCustom: false,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("ExerciseDetail", () => {
  it("shows the curation that the list row has no room for", () => {
    render(
      <ExerciseDetail
        exercise={exercise({
          secondaryMuscles: ["triceps", "front-delts"],
          stabilizerMuscles: ["abs"],
          movementPattern: "horizontal-push",
          movementPlanes: ["transverse"],
          technicalDifficulty: "intermediate",
        })}
      />,
    );

    expect(screen.getByText("Também trabalha")).toBeInTheDocument();
    expect(screen.getByText(/Tríceps/)).toBeInTheDocument();
    expect(screen.getByText("Estabilizadores")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Plano")).toBeInTheDocument();
  });

  it("omits a field nobody has decided instead of printing a dash", () => {
    // `null` means undecided in this model. Rendering "Padrão: —" would turn
    // an honest gap into noise on the majority of the catalogue.
    render(<ExerciseDetail exercise={exercise()} />);

    expect(screen.queryByText("Padrão")).not.toBeInTheDocument();
    expect(screen.queryByText("Dificuldade técnica")).not.toBeInTheDocument();
    expect(screen.queryByText("Estabilizadores")).not.toBeInTheDocument();
    expect(screen.queryByText("Outros nomes")).not.toBeInTheDocument();
  });

  it("distinguishes isolated from compound, and says neither when undecided", () => {
    const { rerender } = render(
      <ExerciseDetail exercise={exercise({ isCompound: true })} />,
    );
    expect(screen.getByText(/Composto/)).toBeInTheDocument();

    rerender(<ExerciseDetail exercise={exercise({ isCompound: false })} />);
    expect(screen.getByText(/Isolado/)).toBeInTheDocument();

    rerender(<ExerciseDetail exercise={exercise({ isCompound: null })} />);
    expect(screen.queryByText("Tipo")).not.toBeInTheDocument();
  });

  it("credits the photographer only where a photo is shown", () => {
    const { rerender } = render(<ExerciseDetail exercise={exercise()} />);
    expect(screen.queryByText(/Everkinetic/)).not.toBeInTheDocument();

    rerender(
      <ExerciseDetail
        exercise={exercise({
          media: {
            source: "free-exercise-db",
            images: ["a/0.jpg", "a/1.jpg"],
            credit: null,
          },
        })}
      />,
    );
    expect(screen.getByText(/Everkinetic/)).toBeInTheDocument();
    expect(screen.getByText(/CC BY-SA 4.0/)).toBeInTheDocument();
  });

  it("says an exercise is the user's own, since the catalogue will not touch it", () => {
    render(<ExerciseDetail exercise={exercise({ isCustom: true })} />);

    expect(screen.getByText(/criado por você/)).toBeInTheDocument();
  });
});

/**
 * Roadmap 7.4 (30/09/2026): "Seu histórico" no detalhe do exercício. Tudo sai
 * dos treinos salvos; sem treino, diz isso, sem zero inventado.
 */
describe("ExerciseDetail — Seu histórico", () => {
  const DAY = 86_400_000;
  const BASE = new Date(2026, 8, 1, 7).getTime();

  function done(reps: number | null, weightKg: number | null) {
    return {
      id: `s-${String(Math.random())}`,
      reps,
      weightKg,
      rpe: null,
      durationSeconds: null,
      isCompleted: true,
      planned: null,
    };
  }

  function trained(exerciseId: string, daysAfter: number, sets: ReturnType<typeof done>[]): Session {
    const startedAt = BASE + daysAfter * DAY;
    return {
      id: `session-${String(daysAfter)}`,
      routineId: null,
      name: "Treino A",
      startedAt,
      finishedAt: startedAt + 3_600_000,
      exercises: [{ id: `e-${String(daysAfter)}`, exerciseId, name: "Supino", sets, restSeconds: null, notes: "" }],
      createdAt: startedAt,
      updatedAt: startedAt,
    };
  }

  it("sem treino, diz que ainda não foi feito", async () => {
    render(<ExerciseDetail exercise={exercise()} />);

    expect(await screen.findByText("Você ainda não fez este exercício.")).toBeInTheDocument();
  });

  it("mostra série mais pesada, 1RM, gráfico e os últimos treinos, do mais recente", async () => {
    const ex = exercise();
    render(<ExerciseDetail exercise={ex} />, [
      trained(ex.id, 0, [done(8, 55)]),
      trained(ex.id, 7, [done(8, 57.5)]),
      trained(ex.id, 14, [done(10, 40), done(8, 60)]),
      trained(ex.id, 21, [done(8, 60)]),
    ]);

    expect(await screen.findByText("Série mais pesada (kg × reps)")).toBeInTheDocument();
    expect(screen.getByText("60 × 8")).toBeInTheDocument();
    expect(screen.getByText("1RM estimado")).toBeInTheDocument();
    expect(screen.getByRole("figure")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows[0]).toContain("60×8");
    expect(rows[1]).toContain("40×10 · 60×8");
    expect(screen.getByRole("button", { name: "Ver o outro treino" })).toBeInTheDocument();
  });

  it("sem carga (peso do corpo), só a lista: sem gráfico e sem 1RM", async () => {
    const ex = exercise();
    render(<ExerciseDetail exercise={ex} />, [
      trained(ex.id, 0, [done(10, null)]),
      trained(ex.id, 7, [done(12, null)]),
    ]);

    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.queryByText("1RM estimado")).not.toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });
});

describe("ExerciseDetail — ordem", () => {
  it("o histórico vem antes da ficha do exercício (Pedro, 30/09/2026)", async () => {
    render(<ExerciseDetail exercise={exercise()} />);

    const history = await screen.findByText("Seu histórico");
    const definitions = screen.getByText("Músculos principais");

    expect(
      history.compareDocumentPosition(definitions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
