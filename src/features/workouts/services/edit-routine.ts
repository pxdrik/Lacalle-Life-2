import { revise, type EntityId } from "@/core/domain/entity";

import type { PlannedSet, Routine, RoutineExercise } from "../types/routine";
import { createPlannedSet } from "./create-routine";

/**
 * Every edit is a pure function from one routine to the next.
 *
 * No component splices an array. That keeps the invariants in one testable
 * place and means `revise` stamps `updatedAt` on every path, including the
 * ones added later.
 *
 * An operation naming an exercise or set that is gone returns the routine
 * unchanged — same reference, same timestamp. The UI addresses things by id
 * and can be a frame behind; a stale click must be a no-op, not a crash, and
 * must not look like a write to a future sync.
 */

export function renameRoutine(routine: Routine, name: string): Routine {
  return revise(routine, { name });
}

export function setRoutineNotes(routine: Routine, notes: string): Routine {
  return revise(routine, { notes });
}

export function addExercise(
  routine: Routine,
  exercise: RoutineExercise,
): Routine {
  return revise(routine, { exercises: [...routine.exercises, exercise] });
}

export function removeExercise(routine: Routine, exerciseId: EntityId): Routine {
  return revise(routine, {
    exercises: routine.exercises.filter((item) => item.id !== exerciseId),
  });
}

export type ExerciseChanges = Partial<
  Pick<RoutineExercise, "restSeconds" | "notes">
>;

export function updateExercise(
  routine: Routine,
  exerciseId: EntityId,
  changes: ExerciseChanges,
): Routine {
  return mapExercise(routine, exerciseId, (exercise) => ({
    ...exercise,
    ...changes,
  }));
}

export function addSet(routine: Routine, exerciseId: EntityId): Routine {
  return mapExercise(routine, exerciseId, (exercise) => ({
    ...exercise,
    sets: [...exercise.sets, createPlannedSet(exercise.sets.at(-1))],
  }));
}

export function removeSet(
  routine: Routine,
  exerciseId: EntityId,
  setId: EntityId,
): Routine {
  return mapExercise(routine, exerciseId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((set) => set.id !== setId),
  }));
}

export type SetChanges = Partial<Pick<PlannedSet, "reps" | "weightKg" | "rpe">>;

export function updateSet(
  routine: Routine,
  exerciseId: EntityId,
  setId: EntityId,
  changes: SetChanges,
): Routine {
  return mapExercise(routine, exerciseId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) =>
      set.id === setId ? { ...set, ...changes } : set,
    ),
  }));
}

/** Moves an exercise by `offset`, clamped. Reordering without drag-and-drop. */
export function moveExercise(
  routine: Routine,
  exerciseId: EntityId,
  offset: number,
): Routine {
  const from = routine.exercises.findIndex((item) => item.id === exerciseId);
  if (from === -1) return routine;

  const to = Math.min(Math.max(from + offset, 0), routine.exercises.length - 1);
  if (to === from) return routine;

  const exercises = [...routine.exercises];
  const [moved] = exercises.splice(from, 1);
  exercises.splice(to, 0, moved!);

  return revise(routine, { exercises });
}

function mapExercise(
  routine: Routine,
  exerciseId: EntityId,
  change: (exercise: RoutineExercise) => RoutineExercise,
): Routine {
  if (!routine.exercises.some((item) => item.id === exerciseId)) return routine;

  return revise(routine, {
    exercises: routine.exercises.map((item) =>
      item.id === exerciseId ? change(item) : item,
    ),
  });
}
