import type { Entity } from "@/core/domain/entity";

import type { Equipment } from "../taxonomy/equipment";
import type {
  MovementPattern,
  MovementPlane,
  TechnicalDifficulty,
} from "../taxonomy/movement";
import type { MuscleGroup } from "../taxonomy/muscles";

/**
 * Where an exercise's classification came from.
 *
 * Kept on the record so a future revision of the curated catalogue can refresh
 * its own entries without overwriting anything a user corrected by hand.
 */
export const CLASSIFICATION_SOURCES = ["catalogue", "user"] as const;
export type ClassificationSource = (typeof CLASSIFICATION_SOURCES)[number];

/**
 * An exercise.
 *
 * Every field that describes the body is a list, because the body is plural: an
 * incline press is chest *and* front delts, a row can be barbell *or* dumbbell,
 * and a get-up crosses more than one plane.
 *
 * Every field that might not be known is nullable, and `null` means "nobody has
 * decided" — never `false` and never a guess. An exercise with a trustworthy
 * name and no `technicalDifficulty` shows up in search and stays out of the
 * difficulty filter. One with a guessed difficulty shows up in the *wrong*
 * filter, which is how someone ends up loading a movement they cannot yet hold.
 */
export interface Exercise extends Entity {
  readonly name: string;

  /** Other names people search by. Held in `data/aliases.json`. */
  readonly aliases: readonly string[];

  /** What the exercise is for. Empty means unclassified. */
  readonly primaryMuscles: readonly MuscleGroup[];

  /** Meaningfully loaded, but not the point of the movement. */
  readonly secondaryMuscles: readonly MuscleGroup[];

  /**
   * Working isometrically to hold position rather than to move the load.
   *
   * Its own tier because it answers a different question: a front squat and a
   * leg press train the same prime movers, and only one of them taxes the core.
   * Never counts toward whether an exercise is classified.
   */
  readonly stabilizerMuscles: readonly MuscleGroup[];

  readonly equipment: readonly Equipment[];

  readonly movementPattern: MovementPattern | null;

  /** Dominant plane, or planes for genuinely multi-planar movements. */
  readonly movementPlanes: readonly MovementPlane[];

  /** Technique required to load it safely — not perceived effort. */
  readonly technicalDifficulty: TechnicalDifficulty | null;

  /** Trained one side at a time. `null` when undecided. */
  readonly isUnilateral: boolean | null;

  /**
   * Moves the load through more than one joint acting together.
   *
   * Not a strict joint count. A Romanian deadlift is dominated by the hip and
   * nobody would call it isolation; a hip thrust is programmed as a main lift.
   * The checkable half of the rule lives in the schema instead: an exercise
   * marked isolated must name exactly one primary muscle, which forces a
   * decision rather than a hedge.
   *
   * `null` when undecided.
   */
  readonly isCompound: boolean | null;

  readonly classification: ClassificationSource;
  readonly isCustom: boolean;
  readonly isFavorite: boolean;
}

/**
 * Classified means somebody decided which muscles this trains. Everything else
 * can be filled in later; without this, an exercise cannot answer the question
 * the filters exist to ask.
 */
export function isClassified(exercise: Exercise): boolean {
  return exercise.primaryMuscles.length > 0;
}
