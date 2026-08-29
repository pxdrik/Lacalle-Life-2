import { render, screen } from "@testing-library/react";
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
    expect(header).toHaveTextContent("#");
    expect(header).toHaveTextContent("Reps");
    expect(header).toHaveTextContent("Peso");
    expect(header).toHaveTextContent("RPE");
  });

  describe("a cardio exercise", () => {
    it("swaps the header for a single Duração column", () => {
      render(
        <SessionExerciseCard
          exercise={EXERCISE}
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
      expect(header).toHaveTextContent("RPE");
    });
  });

  describe("Sprint 8 — the exercise holding the next set reads as the hero", () => {
    function mount(nextSetId: string | null) {
      render(
        <SessionExerciseCard
          exercise={EXERCISE}
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
});
