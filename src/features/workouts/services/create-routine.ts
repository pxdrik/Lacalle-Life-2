import { createEntityId } from "@/core/domain/entity";

import type { PlannedSet, Routine, RoutineExercise } from "../types/routine";

/** Sets an exercise arrives with. Three is the most common prescription. */
export const DEFAULT_SET_COUNT = 3;

/**
 * A new routine starts empty.
 *
 * Unlike a diet, which gets one meal so the next click can be "add food",
 * there is nothing to put in a routine before an exercise is chosen — an empty
 * exercise slot is not a thing.
 */
export function createRoutine(name: string): Routine {
  const now = Date.now();

  return {
    id: createEntityId(),
    name: name.trim(),
    notes: "",
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createPlannedSet(previous?: PlannedSet): PlannedSet {
  return {
    id: createEntityId(),
    // A new set copies the one before it: sets within an exercise are usually
    // the same, and retyping 3×8 @ 60 kg three times is work the app can do.
    reps: previous?.reps ?? null,
    weightKg: previous?.weightKg ?? null,
    rpe: previous?.rpe ?? null,
  };
}

export function createRoutineExercise(source: {
  readonly exerciseId: string;
  readonly name: string;
}): RoutineExercise {
  return {
    id: createEntityId(),
    exerciseId: source.exerciseId,
    name: source.name,
    sets: Array.from({ length: DEFAULT_SET_COUNT }, () => createPlannedSet()),
    restSeconds: null,
    notes: "",
  };
}
