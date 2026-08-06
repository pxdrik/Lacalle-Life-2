import type { Entity, EntityId } from "@/core/domain/entity";

/**
 * What the routine asked for, frozen when the session started.
 *
 * Carried on the set itself rather than looked up, because the routine can
 * change tomorrow and this has to keep saying what was actually planned
 * *today*. It is what lets the screen show "planejado RPE 8 · executado RPE 9"
 * — the gap that makes fatigue and adherence analysable later.
 */
export interface PlannedTarget {
  readonly reps: number | null;
  readonly weightKg: number | null;
  readonly rpe: number | null;
}

export interface PerformedSet {
  readonly id: EntityId;
  readonly reps: number | null;
  readonly weightKg: number | null;
  /** What it actually felt like. Optional, like everything about RPE. */
  readonly rpe: number | null;
  readonly isCompleted: boolean;
  /** `null` for a set added mid-workout, which nothing planned. */
  readonly planned: PlannedTarget | null;
}

export interface SessionExercise {
  readonly id: EntityId;
  readonly exerciseId: EntityId;
  readonly name: string;
  readonly sets: readonly PerformedSet[];
  readonly restSeconds: number | null;
  readonly notes: string;
}

/**
 * A workout that happened.
 *
 * A **photograph of the routine at the moment it started**, and independent
 * from it forever after. Editing the routine tomorrow cannot rewrite what was
 * lifted today, and editing today's session cannot rewrite the plan.
 *
 * That independence is structural, not a convention: `startSession` deep-copies
 * everything and mints new ids, so there is no shared reference for a mutation
 * to travel along. `routineId` records where it came from and is deliberately
 * not a live link.
 */
export interface Session extends Entity {
  /** `null` for an ad-hoc workout that was never planned. */
  readonly routineId: EntityId | null;
  readonly name: string;
  readonly startedAt: number;
  /** `null` while the workout is still in progress. */
  readonly finishedAt: number | null;
  readonly exercises: readonly SessionExercise[];
}
