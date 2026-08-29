import { createEntityId, entityTimestamp, revise } from "@/core/domain/entity";

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
  const now = entityTimestamp();

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
    durationSeconds: previous?.durationSeconds ?? null,
  };
}

/**
 * A copy of a whole routine.
 *
 * Every id is minted fresh, down to the individual set. Reusing them would
 * make the two routines share identity, and editing one would be
 * indistinguishable from editing the other to anything addressing by id.
 *
 * The name gains a suffix because the copy sits beside the original in a list.
 */
export function duplicateRoutine(routine: Routine): Routine {
  const now = entityTimestamp();

  return {
    id: createEntityId(),
    name: `${routine.name} (cópia)`,
    notes: routine.notes,
    exercises: routine.exercises.map(copyExercise),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A copy of one exercise, inserted directly below the original.
 *
 * The name is left alone: inside a routine the copy is obviously distinct by
 * position, and duplicating an exercise is usually how a drop set or a second
 * variation gets added.
 */
export function duplicateRoutineExercise(
  routine: Routine,
  exerciseId: string,
): Routine {
  const index = routine.exercises.findIndex((item) => item.id === exerciseId);
  if (index === -1) return routine;

  const exercises = [...routine.exercises];
  exercises.splice(index + 1, 0, copyExercise(routine.exercises[index]!));

  return revise(routine, { exercises });
}

function copyExercise(exercise: RoutineExercise): RoutineExercise {
  return {
    ...exercise,
    id: createEntityId(),
    sets: exercise.sets.map((set) => ({ ...set, id: createEntityId() })),
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
