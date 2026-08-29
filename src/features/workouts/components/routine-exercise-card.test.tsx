import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Exercise } from "../types/exercise";
import type { RoutineExercise } from "../types/routine";
import { RoutineExerciseCard } from "./routine-exercise-card";

const EXERCISE: RoutineExercise = {
  id: "ex1",
  exerciseId: "cat1",
  name: "Esteira",
  restSeconds: null,
  notes: "",
  sets: [{ id: "set1", reps: null, weightKg: null, rpe: null, durationSeconds: null }],
};

function catalogueEntry(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "cat1",
    name: "Esteira",
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

function mount(catalogue: Exercise | undefined) {
  render(
    <RoutineExerciseCard
      exercise={EXERCISE}
      catalogue={catalogue}
      onOpenDetail={vi.fn()}
      position={0}
      total={1}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      onDuplicate={vi.fn()}
      onMove={vi.fn()}
      onAddSet={vi.fn()}
      onRemoveSet={vi.fn()}
      onSetChange={vi.fn()}
    />,
  );
}

describe("the column header", () => {
  it("shows Reps and Peso for an exercise with no cardio classification", () => {
    mount(undefined);

    expect(screen.getByText("Reps")).toBeInTheDocument();
    expect(screen.getByText("Peso")).toBeInTheDocument();
    expect(screen.queryByText("Duração (min)")).not.toBeInTheDocument();
  });

  it("swaps to a single Duração column for a cardio exercise", () => {
    mount(catalogueEntry({ movementPattern: "cardio" }));

    expect(screen.getByText("Duração (min)")).toBeInTheDocument();
    expect(screen.queryByText("Reps")).not.toBeInTheDocument();
    expect(screen.queryByText("Peso")).not.toBeInTheDocument();
  });
});
