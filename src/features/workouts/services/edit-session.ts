import { createEntityId, revise, type EntityId } from "@/core/domain/entity";

import type { PerformedSet, Session, SessionExercise } from "../types/session";

/**
 * Every edit is a pure function from one session to the next.
 *
 * None of these touch the routine the session came from, and none of them can:
 * the session shares no reference with it. That independence is the point of
 * having two aggregates at all.
 *
 * Operations naming something already gone return the same session — a stale
 * tap mid-workout must be a no-op, never a crash.
 */

export function completeSet(
  session: Session,
  exerciseId: EntityId,
  setId: EntityId,
): Session {
  return mapSet(session, exerciseId, setId, (set) => ({
    ...set,
    isCompleted: true,
  }));
}

export function uncompleteSet(
  session: Session,
  exerciseId: EntityId,
  setId: EntityId,
): Session {
  return mapSet(session, exerciseId, setId, (set) => ({
    ...set,
    isCompleted: false,
  }));
}

export type PerformedSetChanges = Partial<
  Pick<PerformedSet, "reps" | "weightKg" | "rpe">
>;

export function updatePerformedSet(
  session: Session,
  exerciseId: EntityId,
  setId: EntityId,
  changes: PerformedSetChanges,
): Session {
  return mapSet(session, exerciseId, setId, (set) => ({ ...set, ...changes }));
}

/**
 * A set added mid-workout has no `planned`: nothing prescribed it. It copies
 * the numbers from the last set, because an extra set is almost always more of
 * the same.
 */
export function addPerformedSet(
  session: Session,
  exerciseId: EntityId,
): Session {
  return mapExercise(session, exerciseId, (exercise) => {
    const last = exercise.sets.at(-1);

    return {
      ...exercise,
      sets: [
        ...exercise.sets,
        {
          id: createEntityId(),
          reps: last?.reps ?? null,
          weightKg: last?.weightKg ?? null,
          rpe: null,
          isCompleted: false,
          planned: null,
        },
      ],
    };
  });
}

export function removePerformedSet(
  session: Session,
  exerciseId: EntityId,
  setId: EntityId,
): Session {
  return mapExercise(session, exerciseId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((set) => set.id !== setId),
  }));
}

export function setSessionExerciseNotes(
  session: Session,
  exerciseId: EntityId,
  notes: string,
): Session {
  return mapExercise(session, exerciseId, (exercise) => ({ ...exercise, notes }));
}

export function renameSession(session: Session, name: string): Session {
  return revise(session, { name });
}

/**
 * Ends the workout. Incomplete sets are left exactly as they are rather than
 * discarded — "I planned four and did three" is information, and deleting the
 * fourth would erase it.
 */
export function finishSession(session: Session, finishedAt = Date.now()): Session {
  if (session.finishedAt !== null) return session;
  return revise(session, { finishedAt });
}

export function reopenSession(session: Session): Session {
  if (session.finishedAt === null) return session;
  return revise(session, { finishedAt: null });
}

function mapExercise(
  session: Session,
  exerciseId: EntityId,
  change: (exercise: SessionExercise) => SessionExercise,
): Session {
  if (!session.exercises.some((item) => item.id === exerciseId)) return session;

  return revise(session, {
    exercises: session.exercises.map((item) =>
      item.id === exerciseId ? change(item) : item,
    ),
  });
}

function mapSet(
  session: Session,
  exerciseId: EntityId,
  setId: EntityId,
  change: (set: PerformedSet) => PerformedSet,
): Session {
  const exercise = session.exercises.find((item) => item.id === exerciseId);
  if (exercise === undefined) return session;
  if (!exercise.sets.some((set) => set.id === setId)) return session;

  return mapExercise(session, exerciseId, (item) => ({
    ...item,
    sets: item.sets.map((set) => (set.id === setId ? change(set) : set)),
  }));
}
