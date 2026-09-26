import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Exercise } from "../types/exercise";
import type { SessionExercise } from "../types/session";
import { SessionExerciseCard } from "./session-exercise-card";

const EXERCISE: SessionExercise = {
  id: "ex1",
  exerciseId: "cat1",
  name: "Supino reto",
  restSeconds: null,
  notes: "",
  sets: [
    {
      id: "set1",
      reps: 8,
      weightKg: 60,
      rpe: null,
      durationSeconds: null,
      isCompleted: false,
      planned: { reps: 8, weightKg: 60, rpe: null, durationSeconds: null },
    },
  ],
};

function catalogueEntry(
  overrides: Partial<Exercise> = {},
): Exercise {
  return {
    id: "cat1",
    name: "Supino reto",
    aliases: [],
    primaryMuscles: [],
    secondaryMuscles: [],
    stabilizerMuscles: [],
    equipment: [],
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

/**
 * The routine editor already prints "# REPS PESO RPE" above its set rows —
 * execution never did. Someone lands on a screen full of numbered fields with
 * no label saying which is which.
 */
describe("SessionExerciseCard", () => {
  it("shows the same column header the routine editor uses", () => {
    render(
      <SessionExerciseCard
        exercise={EXERCISE}
        position={0}
        total={1}
        catalogue={undefined}
        onOpenDetail={vi.fn()}
        nextSetId={null}
        lastTime={undefined}
        onSetChange={vi.fn()}
        onToggleComplete={vi.fn()}
        onRemoveSet={vi.fn()}
        onAddSet={vi.fn()}
        onNotesChange={vi.fn()}
      />,
    );

    const header = screen.getByText("Reps").closest("div");
    expect(header).toHaveTextContent("Reps");
    expect(header).toHaveTextContent("Peso");
    expect(header).toHaveTextContent("RPE");
    // "Série" saiu: o rótulo tem 37,7px de texto e a coluna que ele rotulava
    // tem 18,4px, então ele transbordava por cima de "PESO" em vez de
    // rotular qualquer coisa. A coluna continua reservada, só sem legenda.
    expect(header).not.toHaveTextContent("Série");
  });

  describe("a cardio exercise", () => {
    it("swaps the header for a single Duração column", () => {
      render(
        <SessionExerciseCard
          exercise={EXERCISE}
          position={0}
          total={1}
          catalogue={catalogueEntry({ movementPattern: "cardio" })}
          onOpenDetail={vi.fn()}
          nextSetId={null}
          lastTime={undefined}
          onSetChange={vi.fn()}
          onToggleComplete={vi.fn()}
          onRemoveSet={vi.fn()}
          onAddSet={vi.fn()}
          onNotesChange={vi.fn()}
        />,
      );

      const header = screen.getByText("Duração (min)").closest("div");
      expect(header).toHaveTextContent("Duração (min)");
      expect(header).not.toHaveTextContent("Reps");
      expect(header).not.toHaveTextContent("Peso");
      // RPE rates effort against a rep/weight target, which a timed exercise
      // has neither of.
      expect(header).not.toHaveTextContent("RPE");
    });
  });

  describe("Sprint 8 — the exercise holding the next set reads as the hero", () => {
    function mount(nextSetId: string | null) {
      render(
        <SessionExerciseCard
          exercise={EXERCISE}
          position={0}
          total={1}
          catalogue={undefined}
          onOpenDetail={vi.fn()}
          nextSetId={nextSetId}
          lastTime={undefined}
          onSetChange={vi.fn()}
          onToggleComplete={vi.fn()}
          onRemoveSet={vi.fn()}
          onAddSet={vi.fn()}
          onNotesChange={vi.fn()}
        />,
      );

      return screen.getByText("Supino reto").closest("section");
    }

    it("gets the hero rail when it holds the next set", () => {
      expect(mount("set1")?.className).toContain("border-l-accent");
    });

    it("stays a plain card once nothing in it is next", () => {
      expect(mount(null)?.className).not.toContain("border-l-accent");
    });
  });

  describe("RM07 — swapping the exercise mid-workout", () => {
    function mount(exercise: SessionExercise, onSwap = vi.fn()) {
      render(
        <SessionExerciseCard
          exercise={exercise}
          position={0}
          total={1}
          catalogue={undefined}
          onOpenDetail={vi.fn()}
          nextSetId={null}
          lastTime={undefined}
          onSetChange={vi.fn()}
          onToggleComplete={vi.fn()}
          onRemoveSet={vi.fn()}
          onAddSet={vi.fn()}
          onNotesChange={vi.fn()}
          onSwap={onSwap}
        />,
      );
      return { onSwap };
    }

    it("does not render a swap button without onSwap", () => {
      render(
        <SessionExerciseCard
          exercise={EXERCISE}
          position={0}
          total={1}
          catalogue={undefined}
          onOpenDetail={vi.fn()}
          nextSetId={null}
          lastTime={undefined}
          onSetChange={vi.fn()}
          onToggleComplete={vi.fn()}
          onRemoveSet={vi.fn()}
          onAddSet={vi.fn()}
          onNotesChange={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /Trocar/ }),
      ).not.toBeInTheDocument();
    });

    it("calls onSwap when the exercise has no completed sets yet", async () => {
      const user = userEvent.setup();
      const { onSwap } = mount(EXERCISE);

      await user.click(
        screen.getByRole("button", { name: "Trocar Supino reto por outro exercício" }),
      );

      expect(onSwap).toHaveBeenCalledOnce();
    });

    it("disables the swap button once a set is already completed", () => {
      const done: SessionExercise = {
        ...EXERCISE,
        sets: [{ ...EXERCISE.sets[0]!, isCompleted: true }],
      };
      mount(done);

      expect(
        screen.getByRole("button", { name: "Trocar Supino reto por outro exercício" }),
      ).toBeDisabled();
    });
  });

  describe("reordenar o exercício durante o treino", () => {
    // `onMove` sem valor padrão de propósito: `= vi.fn()` faria
    // `mount(1, 3, undefined)` cair no padrão em vez de passar `undefined`,
    // e o teste de "sem seta nenhuma" testaria o contrário do que diz.
    function mount(
      position: number,
      total: number,
      onMove: ((offset: number) => void) | undefined,
    ) {
      render(
        <SessionExerciseCard
          exercise={EXERCISE}
          position={position}
          total={total}
          catalogue={undefined}
          onOpenDetail={vi.fn()}
          nextSetId={null}
          lastTime={undefined}
          onSetChange={vi.fn()}
          onToggleComplete={vi.fn()}
          onRemoveSet={vi.fn()}
          onAddSet={vi.fn()}
          onNotesChange={vi.fn()}
          onMove={onMove}
        />,
      );
      return { onMove };
    }

    const up = () =>
      screen.getByRole("button", { name: "Mover Supino reto para cima" });
    const down = () =>
      screen.getByRole("button", { name: "Mover Supino reto para baixo" });

    it("sobe e desce chamam onMove com -1 e +1", async () => {
      const user = userEvent.setup();
      const { onMove } = mount(1, 3, vi.fn());

      await user.click(up());
      expect(onMove).toHaveBeenLastCalledWith(-1);

      await user.click(down());
      expect(onMove).toHaveBeenLastCalledWith(1);
    });

    it("o primeiro não sobe", () => {
      mount(0, 3, vi.fn());
      expect(up()).toBeDisabled();
      expect(down()).toBeEnabled();
    });

    it("o último não desce", () => {
      mount(2, 3, vi.fn());
      expect(up()).toBeEnabled();
      expect(down()).toBeDisabled();
    });

    it("um exercício sozinho não tem para onde ir", () => {
      mount(0, 1, vi.fn());
      expect(up()).toBeDisabled();
      expect(down()).toBeDisabled();
    });

    it("sem onMove não renderiza seta nenhuma — o editor de um treino já feito não reordena", () => {
      mount(1, 3, undefined);

      expect(
        screen.queryByRole("button", { name: /Mover/ }),
      ).not.toBeInTheDocument();
    });
  });
});
