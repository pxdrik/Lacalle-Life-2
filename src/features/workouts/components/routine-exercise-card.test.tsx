import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function mount(
  catalogue: Exercise | undefined,
  overrides: Partial<React.ComponentProps<typeof RoutineExerciseCard>> = {},
) {
  const onSwap = vi.fn();
  const { container } = render(
    <RoutineExerciseCard
      exercise={EXERCISE}
      catalogue={catalogue}
      onOpenDetail={vi.fn()}
      position={0}
      total={1}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      onDuplicate={vi.fn()}
      onSwap={onSwap}
      onMove={vi.fn()}
      onAddSet={vi.fn()}
      onRemoveSet={vi.fn()}
      onSetChange={vi.fn()}
      {...overrides}
    />,
  );
  return { onSwap, card: container.querySelector("section") };
}

describe("the column header", () => {
  it("shows Reps, Peso and RPE for an exercise with no cardio classification", () => {
    mount(undefined);

    expect(screen.getByText("Reps")).toBeInTheDocument();
    expect(screen.getByText("Peso")).toBeInTheDocument();
    expect(screen.getByText("RPE")).toBeInTheDocument();
    expect(screen.queryByText("Duração (min)")).not.toBeInTheDocument();
  });

  it("swaps to a single Duração column for a cardio exercise, dropping RPE too", () => {
    mount(catalogueEntry({ movementPattern: "cardio" }));

    expect(screen.getByText("Duração (min)")).toBeInTheDocument();
    expect(screen.queryByText("Reps")).not.toBeInTheDocument();
    expect(screen.queryByText("Peso")).not.toBeInTheDocument();
    // RPE rates effort against a rep/weight target, which a timed exercise
    // has neither of.
    expect(screen.queryByText("RPE")).not.toBeInTheDocument();
  });
});

describe("swapping the exercise", () => {
  it("calls onSwap, naming the exercise being swapped", async () => {
    const user = userEvent.setup();
    const { onSwap } = mount(undefined);

    await user.click(
      screen.getByRole("button", { name: "Trocar Esteira por outro exercício" }),
    );

    expect(onSwap).toHaveBeenCalledOnce();
  });
});

describe("the entrance animation", () => {
  it("is not present by default", () => {
    const { card } = mount(undefined);

    expect(card).not.toHaveClass("animate-rise");
  });

  it("plays only when the card is the one just added", () => {
    const { card } = mount(undefined, { justAdded: true });

    expect(card).toHaveClass("animate-rise");
  });
});
