import type { Entity, EntityId } from "@/core/domain/entity";

/**
 * A set as planned. Every field is optional: someone writing "3 séries de
 * agachamento" and filling the numbers at the gym is a normal way to plan.
 */
export interface PlannedSet {
  readonly id: EntityId;
  readonly reps: number | null;
  readonly weightKg: number | null;
  /** Target effort. Optional — nobody has to plan an RPE to plan a set. */
  readonly rpe: number | null;
}

/**
 * One exercise inside a routine.
 *
 * `exerciseId` is a real reference, not just provenance — unlike a meal item,
 * which only copies. Load history is per exercise across months, so the link
 * back to the catalogue entry has to survive. That is what `ids.lock.json`
 * protects.
 *
 * `name` is copied anyway, so deleting a catalogue entry leaves a readable
 * routine rather than a blank row.
 */
export interface RoutineExercise {
  readonly id: EntityId;
  readonly exerciseId: EntityId;
  readonly name: string;
  readonly sets: readonly PlannedSet[];
  readonly restSeconds: number | null;
  readonly notes: string;
}

/**
 * The plan. Edited freely, and never changed by anything that happens in the
 * gym — see `Session`.
 */
export interface Routine extends Entity {
  readonly name: string;
  readonly notes: string;
  readonly exercises: readonly RoutineExercise[];
}
