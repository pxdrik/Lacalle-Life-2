import type { Equipment } from "../taxonomy/equipment";
import type {
  MovementPattern,
  TechnicalDifficulty,
} from "../taxonomy/movement";
import type { MuscleGroup } from "../taxonomy/muscles";
import type { Exercise } from "../types/exercise";

/**
 * Active filters.
 *
 * Every dimension is a set, and an empty set means "no constraint" rather than
 * "match nothing" — so the default, unfiltered state is the empty object and
 * needs no special case anywhere.
 *
 * Within a dimension the values are OR'd (chest *or* lats); across dimensions
 * they are AND'd (a chest exercise *and* one that uses dumbbells). That is
 * what people expect from filter chips, and stating it here is cheaper than
 * discovering it from the code later.
 */
export interface ExerciseFilters {
  readonly muscles: ReadonlySet<MuscleGroup>;
  readonly equipment: ReadonlySet<Equipment>;
  readonly patterns: ReadonlySet<MovementPattern>;
  readonly difficulties: ReadonlySet<TechnicalDifficulty>;
  readonly favoritesOnly: boolean;
}

export const EMPTY_FILTERS: ExerciseFilters = {
  muscles: new Set(),
  equipment: new Set(),
  patterns: new Set(),
  difficulties: new Set(),
  favoritesOnly: false,
};

export function countActiveFilters(filters: ExerciseFilters): number {
  return (
    filters.muscles.size +
    filters.equipment.size +
    filters.patterns.size +
    filters.difficulties.size +
    (filters.favoritesOnly ? 1 : 0)
  );
}

/**
 * Muscle filters match primary *or* secondary.
 *
 * Someone filtering by triceps wants the close-grip bench press, where triceps
 * are the point but the entry names chest as well. Stabilisers are excluded:
 * every heavy lift stabilises with the core, and including them would make the
 * abs filter return the whole catalogue.
 */
function trains(exercise: Exercise, muscle: MuscleGroup): boolean {
  return (
    exercise.primaryMuscles.includes(muscle) ||
    exercise.secondaryMuscles.includes(muscle)
  );
}

export function filterExercises(
  exercises: readonly Exercise[],
  filters: ExerciseFilters,
): readonly Exercise[] {
  if (countActiveFilters(filters) === 0) return exercises;

  return exercises.filter((exercise) => {
    if (filters.favoritesOnly && !exercise.isFavorite) return false;

    if (
      filters.muscles.size > 0 &&
      ![...filters.muscles].some((muscle) => trains(exercise, muscle))
    ) {
      return false;
    }

    if (
      filters.equipment.size > 0 &&
      !exercise.equipment.some((item) => filters.equipment.has(item))
    ) {
      return false;
    }

    // An unclassified exercise has no pattern and no difficulty. It stays out
    // of those filters rather than being guessed into one — the same decision
    // the catalogue makes by omitting the field.
    if (
      filters.patterns.size > 0 &&
      (exercise.movementPattern === null ||
        !filters.patterns.has(exercise.movementPattern))
    ) {
      return false;
    }

    if (
      filters.difficulties.size > 0 &&
      (exercise.technicalDifficulty === null ||
        !filters.difficulties.has(exercise.technicalDifficulty))
    ) {
      return false;
    }

    return true;
  });
}
