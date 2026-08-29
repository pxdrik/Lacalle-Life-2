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
  Pick<PerformedSet, "reps" | "weightKg" | "rpe" | "durationSeconds">
>;

export function updatePerformedSet(
  session: Session,
  exerciseId: EntityId,
  setId: EntityId,
  changes: PerformedSetChanges,
): Session {
  return mapSet(session, exerciseId, setId, (set) => ({
    ...set,
    ...sanitizeSetChanges(changes),
  }));
}

/**
 * Negative weight has no meaning for a set someone actually performed, and
 * this is the one function every caller — the live UI, a future import path,
 * a test — goes through to write it. Found by an external audit
 * (27/08/2026): `WeightField` passed a typo'd minus sign straight through,
 * and the negative set *subtracted* from the Volume total in Evolução
 * instead of failing anywhere. `WeightField` itself no longer lets the
 * character be typed, but that is the UI being polite, not the guarantee —
 * this is.
 *
 * Drops the field rather than clamping it to `0` or throwing: a no-op that
 * leaves the set's previous weight in place is the same "stale tap changes
 * nothing" contract every other operation in this file already has, and
 * inventing a `0` the person never typed would be exactly the kind of
 * fabricated number this codebase refuses to show elsewhere.
 */
function sanitizeSetChanges(changes: PerformedSetChanges): PerformedSetChanges {
  let sanitized = changes;

  if (
    sanitized.weightKg !== undefined &&
    sanitized.weightKg !== null &&
    sanitized.weightKg < 0
  ) {
    const { weightKg: _rejected, ...rest } = sanitized;
    sanitized = rest;
  }

  if (
    sanitized.durationSeconds !== undefined &&
    sanitized.durationSeconds !== null &&
    sanitized.durationSeconds < 0
  ) {
    const { durationSeconds: _rejected, ...rest } = sanitized;
    sanitized = rest;
  }

  return sanitized;
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
          durationSeconds: last?.durationSeconds ?? null,
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
  return mapExercise(session, exerciseId, (exercise) => ({
    ...exercise,
    notes,
  }));
}

/**
 * Moves a workout to the day it actually happened.
 *
 * Exists because the app could only ever stamp "now". Someone who trained on
 * Saturday and logged it on Sunday had a choice between a wrong date and no
 * record — and a wrong date is worse, because volume-per-week and "última vez"
 * both read from these timestamps.
 *
 * **Duration is preserved, not recomputed.** The gap between start and finish
 * is what was measured; only the calendar day is being corrected. Shifting
 * both stamps by the same amount keeps a 47-minute workout 47 minutes long.
 *
 * **The time of day is preserved too.** A workout logged at 07:12 stays at
 * 07:12 on the new date — the person is fixing which day, not what time.
 *
 * A session still running has no `finishedAt`, and only its start moves.
 */
export function moveSessionToDay(session: Session, day: string): Session {
  const [year, month, date] = day.split("-").map(Number);
  if (year === undefined || month === undefined || date === undefined) {
    return session;
  }

  const started = new Date(session.startedAt);
  const moved = new Date(
    year,
    month - 1,
    date,
    started.getHours(),
    started.getMinutes(),
    started.getSeconds(),
    started.getMilliseconds(),
  );

  const startedAt = moved.getTime();
  if (Number.isNaN(startedAt) || startedAt === session.startedAt)
    return session;

  const shift = startedAt - session.startedAt;

  return revise(session, {
    startedAt,
    finishedAt: session.finishedAt === null ? null : session.finishedAt + shift,
  });
}

export function renameSession(session: Session, name: string): Session {
  return revise(session, { name });
}

/**
 * Corrects when a running workout actually started.
 *
 * Only `startedAt` moves, and only while the session is still running —
 * `moveSessionToDay` is the tool for a finished one, and it deliberately
 * shifts both stamps together to keep the measured duration intact. This one
 * exists for the opposite problem: a phone locked mid-workout leaves the
 * session open, and "começou há 56 horas" is wrong until someone tells it
 * when the workout actually began.
 */
export function setSessionStartedAt(
  session: Session,
  startedAt: number,
): Session {
  if (session.finishedAt !== null) return session;
  if (!Number.isFinite(startedAt)) return session;
  if (startedAt > Date.now() || startedAt === session.startedAt) return session;

  return revise(session, { startedAt });
}

/**
 * Ends the workout. Incomplete sets are left exactly as they are rather than
 * discarded — "I planned four and did three" is information, and deleting the
 * fourth would erase it.
 */
export function finishSession(
  session: Session,
  finishedAt = Date.now(),
): Session {
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
