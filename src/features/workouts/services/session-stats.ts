import type { PerformedSet, Session } from "../types/session";

export interface SessionProgress {
  readonly completed: number;
  readonly total: number;
}

export function sessionProgress(session: Session): SessionProgress {
  let completed = 0;
  let total = 0;

  for (const exercise of session.exercises) {
    total += exercise.sets.length;
    completed += exercise.sets.filter((set) => set.isCompleted).length;
  }

  return { completed, total };
}

/**
 * Load moved, in kilograms.
 *
 * Only completed sets count, and only those with both a weight and a rep
 * count. A set logged at bodyweight contributes nothing to a kilogram total,
 * which is honest — it is not zero effort, it is unmeasured load.
 */
export function sessionVolumeKg(session: Session): number {
  let volume = 0;

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (!set.isCompleted) continue;
      if (set.reps === null || set.weightKg === null) continue;

      // Same reasoning as `sumMacros`: a stored set holds whatever it holds,
      // and one unreadable weight must not erase the volume of an entire
      // training history. `null` already means "not recorded"; this covers the
      // values that are present and still not numbers.
      const contribution = set.reps * set.weightKg;
      if (Number.isFinite(contribution)) volume += contribution;
    }
  }

  return Math.round(volume);
}

/** Milliseconds the workout has been running. Needs a clock, so it takes one. */
export function sessionElapsedMs(session: Session, now: number): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

/**
 * How long a finished workout took. `null` while it is still running.
 *
 * Separate from `sessionElapsedMs` so a summary never has to invent a clock:
 * reading `Date.now()` during render is impure, and a finished session already
 * knows both of its endpoints.
 */
export function sessionDurationMs(session: Session): number | null {
  if (session.finishedAt === null) return null;
  return Math.max(0, session.finishedAt - session.startedAt);
}

/**
 * The set the app should be pointing at: the first one not yet done.
 *
 * `null` once everything is complete, which is what turns the screen's primary
 * action into "finish".
 */
export function nextIncompleteSet(
  session: Session,
): { readonly exerciseId: string; readonly setId: string } | null {
  for (const exercise of session.exercises) {
    const set = exercise.sets.find((item) => !item.isCompleted);
    if (set !== undefined) return { exerciseId: exercise.id, setId: set.id };
  }

  return null;
}

/** How the set that was done compares to what was planned for it. */
export function comparePlanned(set: PerformedSet): {
  readonly repsDelta: number | null;
  readonly weightDelta: number | null;
  readonly rpeDelta: number | null;
} {
  const planned = set.planned;

  return {
    repsDelta: delta(set.reps, planned?.reps ?? null),
    weightDelta: delta(set.weightKg, planned?.weightKg ?? null),
    rpeDelta: delta(set.rpe, planned?.rpe ?? null),
  };
}

function delta(actual: number | null, planned: number | null): number | null {
  if (actual === null || planned === null) return null;
  return Math.round((actual - planned) * 100) / 100;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${String(minutes)}:${pad(seconds)}`;
}
