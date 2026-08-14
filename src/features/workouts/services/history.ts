import type { EntityId } from "@/core/domain/entity";

import type { PerformedSet, Session, SessionExercise } from "../types/session";

/**
 * Reading the past.
 *
 * Everything here derives from the sessions already stored — no new entity, no
 * precomputed table. That keeps one source of truth, and it is fast enough:
 * a session document is around 1.5 KB, so five years of training at three
 * workouts a week is a couple of megabytes read once per screen.
 *
 * When that stops being true, the fix is a derived index rebuilt on write, and
 * these signatures do not change.
 */

const isDone = (set: PerformedSet) => set.isCompleted;

/** Only finished workouts count as history. One in progress is not a fact yet. */
export function finishedSessions(
  sessions: readonly Session[],
): readonly Session[] {
  return sessions
    .filter((session) => session.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export interface LastPerformance {
  readonly performedAt: number;
  readonly sessionId: EntityId;
  readonly sets: readonly PerformedSet[];
}

/**
 * What was done the last time this exercise was trained.
 *
 * The single most useful number in a workout app: without it the load is
 * guessed every session, and guessing is what separates a logger from a
 * training tool.
 *
 * `excludeSessionId` keeps the workout in progress from answering questions
 * about itself.
 */
export function lastPerformance(
  sessions: readonly Session[],
  exerciseId: EntityId,
  excludeSessionId?: EntityId,
): LastPerformance | null {
  for (const session of finishedSessions(sessions)) {
    if (session.id === excludeSessionId) continue;

    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;

      const sets = exercise.sets.filter(isDone);
      if (sets.length === 0) continue;

      return { performedAt: session.startedAt, sessionId: session.id, sets };
    }
  }

  return null;
}

/** One lookup for a whole workout, so the screen reads history once. */
export function lastPerformanceByExercise(
  sessions: readonly Session[],
  exerciseIds: readonly EntityId[],
  excludeSessionId?: EntityId,
): ReadonlyMap<EntityId, LastPerformance> {
  const found = new Map<EntityId, LastPerformance>();

  for (const exerciseId of new Set(exerciseIds)) {
    const performance = lastPerformance(sessions, exerciseId, excludeSessionId);
    if (performance !== null) found.set(exerciseId, performance);
  }

  return found;
}

/**
 * Estimated one-rep max, Epley.
 *
 * `weight × (1 + reps / 30)`. An estimate, and a worse one the further the set
 * is from a single — above about ten reps it flatters. It earns its place
 * because comparing 8 × 60 kg against 5 × 70 kg is otherwise a judgement call,
 * and progression needs one number.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;

  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export interface PersonalRecord {
  readonly exerciseId: EntityId;
  readonly name: string;
  /** Heaviest completed set, and what it was done for. */
  readonly heaviestKg: number;
  readonly repsAtHeaviest: number;
  readonly heaviestAt: number;
  /** Best estimated single, which can come from a different set entirely. */
  readonly bestOneRepMax: number;
  readonly bestOneRepMaxAt: number;
}

/**
 * Best set per exercise, across all history.
 *
 * Heaviest and best estimated single are tracked separately on purpose: they
 * are often different sets, and collapsing them would hide one of them.
 */
export function personalRecords(
  sessions: readonly Session[],
): readonly PersonalRecord[] {
  const records = new Map<EntityId, PersonalRecord>();

  for (const session of finishedSessions(sessions)) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (!isDone(set)) continue;
        if (set.weightKg === null || set.reps === null) continue;
        if (set.weightKg <= 0 || set.reps <= 0) continue;

        const oneRepMax = estimateOneRepMax(set.weightKg, set.reps);
        const current = records.get(exercise.exerciseId);

        if (current === undefined) {
          records.set(exercise.exerciseId, {
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            heaviestKg: set.weightKg,
            repsAtHeaviest: set.reps,
            heaviestAt: session.startedAt,
            bestOneRepMax: oneRepMax,
            bestOneRepMaxAt: session.startedAt,
          });
          continue;
        }

        records.set(exercise.exerciseId, {
          ...current,
          ...(set.weightKg > current.heaviestKg
            ? {
                heaviestKg: set.weightKg,
                repsAtHeaviest: set.reps,
                heaviestAt: session.startedAt,
              }
            : {}),
          ...(oneRepMax > current.bestOneRepMax
            ? { bestOneRepMax: oneRepMax, bestOneRepMaxAt: session.startedAt }
            : {}),
        });
      }
    }
  }

  return [...records.values()].sort(
    (a, b) => b.bestOneRepMax - a.bestOneRepMax,
  );
}

export interface VolumePoint {
  /** Midnight, local time, of the period's first day. */
  readonly startsAt: number;
  readonly volumeKg: number;
  readonly sets: number;
  readonly sessions: number;
}

/** Monday, local time, of the week containing `timestamp`. */
export function startOfWeek(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  // getDay() is 0 for Sunday; the Brazilian training week starts on Monday.
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);

  return date.getTime();
}

export function startOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);

  return date.getTime();
}

function setVolume(set: PerformedSet): number {
  if (!isDone(set)) return 0;
  if (set.reps === null || set.weightKg === null) return 0;
  return set.reps * set.weightKg;
}

function countSets(exercise: SessionExercise): number {
  return exercise.sets.filter(isDone).length;
}

/**
 * Volume per period, most recent first.
 *
 * Empty periods are included, because a gap is exactly the thing the chart
 * exists to show — skipping them would draw an unbroken line over two weeks
 * off.
 */
export function volumeByPeriod(
  sessions: readonly Session[],
  periods: number,
  bucketOf: (timestamp: number) => number,
  now = Date.now(),
): readonly VolumePoint[] {
  const buckets = new Map<
    number,
    { volumeKg: number; sets: number; sessions: number }
  >();

  // Seed every period so gaps survive into the output.
  let cursor = bucketOf(now);
  for (let index = 0; index < periods; index += 1) {
    buckets.set(cursor, { volumeKg: 0, sets: 0, sessions: 0 });
    cursor = bucketOf(cursor - 1);
  }

  const oldest = Math.min(...buckets.keys());

  for (const session of finishedSessions(sessions)) {
    if (session.startedAt < oldest) break;

    const bucket = buckets.get(bucketOf(session.startedAt));
    if (bucket === undefined) continue;

    bucket.sessions += 1;
    for (const exercise of session.exercises) {
      bucket.sets += countSets(exercise);
      for (const set of exercise.sets) bucket.volumeKg += setVolume(set);
    }
  }

  return [...buckets.entries()]
    .map(([startsAt, totals]) => ({
      startsAt,
      volumeKg: Math.round(totals.volumeKg),
      sets: totals.sets,
      sessions: totals.sessions,
    }))
    .sort((a, b) => b.startsAt - a.startsAt);
}

/** How far back the execution trail looks. Eight weeks of real calendar. */
export const TRAIL_WEEKS = 8;
const TRAIL_MS = TRAIL_WEEKS * 7 * 24 * 60 * 60 * 1000;

export interface ExecutionTrail {
  /**
   * One entry per finished session inside the window, oldest first, as a
   * fraction of the window: `0` is eight weeks ago, `1` is now.
   */
  readonly marks: readonly number[];
  /** The most recent finish, window or not — `null` if never executed. */
  readonly lastAt: number | null;
  /** How many finished sessions fall inside the window. */
  readonly countInWindow: number;
}

/**
 * When a routine was actually trained, positioned in real time.
 *
 * **The position is the point.** A routine done three times in ten days and one
 * abandoned two months ago have the same count and the same card; only spacing
 * tells them apart. Distributing the marks evenly would throw away the single
 * fact this exists to show — the gaps — and turn a record into an ornament.
 *
 * Reads `routineId`, which sessions have carried since they were introduced, so
 * this invents no data and stores nothing. A session with a `null` routine —
 * started before the link existed, or from a routine since deleted — belongs to
 * no trail rather than to every trail.
 *
 * Unfinished sessions are excluded by `finishedSessions`: a workout in progress
 * is not a fact yet, which is the same rule the history has always used.
 */
export function executionTrail(
  sessions: readonly Session[],
  routineId: EntityId,
  now: number,
): ExecutionTrail {
  const mine = finishedSessions(sessions).filter(
    (session) => session.routineId === routineId,
  );

  const start = now - TRAIL_MS;
  const inWindow = mine.filter(
    (session) => (session.finishedAt ?? 0) >= start,
  );

  return {
    // Oldest first so the marks read left to right, like the time they show.
    marks: inWindow
      .map((session) => ((session.finishedAt ?? 0) - start) / TRAIL_MS)
      .map((ratio) => Math.min(Math.max(ratio, 0), 1))
      .sort((a, b) => a - b),
    lastAt: mine[0]?.finishedAt ?? null,
    countInWindow: inWindow.length,
  };
}
