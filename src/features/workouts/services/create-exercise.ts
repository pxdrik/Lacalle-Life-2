import { createEntityId } from "@/core/domain/entity";

import type { Exercise } from "../types/exercise";
import type { CustomExerciseInput } from "../validation/custom-exercise-schema";

/**
 * Builds an exercise the user created.
 *
 * A random id, never a slug of the name: catalogue ids are curated and frozen
 * in `ids.lock.json`, and a user typing "Supino Reto com Barra" must not
 * collide with the entry that already owns that slug.
 *
 * `classification: "user"` is what stops a future revision of the curated
 * catalogue from overwriting it.
 */
export function createCustomExercise(input: CustomExerciseInput): Exercise {
  const now = Date.now();

  return {
    id: createEntityId(),
    name: input.name.trim(),
    aliases: [],
    primaryMuscles: input.primaryMuscles,
    secondaryMuscles: [],
    stabilizerMuscles: [],
    equipment: input.equipment,
    movementPattern: null,
    movementPlanes: [],
    technicalDifficulty: null,
    isUnilateral: null,
    isCompound: null,
    media: null,
    classification: "user",
    isCustom: true,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  };
}
