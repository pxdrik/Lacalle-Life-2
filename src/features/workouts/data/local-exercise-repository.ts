import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";

import type { Exercise } from "../types/exercise";
import type { ExerciseRepository } from "./exercise-repository";

export class LocalExerciseRepository implements ExerciseRepository {
  readonly #store: Store<Exercise>;

  constructor(store: Store<Exercise>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly Exercise[]> {
    const exercises = await this.#store.getAll();
    return exercises.map(normalize).sort(byName);
  }

  async getById(id: EntityId): Promise<Exercise | undefined> {
    const exercise = await this.#store.get(id);
    return exercise === undefined ? undefined : normalize(exercise);
  }

  save(exercise: Exercise): Promise<void> {
    return this.#store.put(exercise);
  }

  saveMany(exercises: readonly Exercise[]): Promise<void> {
    return this.#store.putMany(exercises);
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }

  async isEmpty(): Promise<boolean> {
    return (await this.#store.count()) === 0;
  }
}

/**
 * A record written by an earlier version can be missing a field added since.
 * Filling defaults on read means the rest of the app treats `Exercise` as
 * complete, and adding a field never needs a destructive migration.
 */
function normalize(exercise: Exercise): Exercise {
  return {
    ...exercise,
    aliases: exercise.aliases ?? [],
    primaryMuscles: exercise.primaryMuscles ?? [],
    secondaryMuscles: exercise.secondaryMuscles ?? [],
    stabilizerMuscles: exercise.stabilizerMuscles ?? [],
    equipment: exercise.equipment ?? [],
    movementPlanes: exercise.movementPlanes ?? [],
    isFavorite: exercise.isFavorite ?? false,
  };
}

/**
 * IndexedDB orders strings by UTF-16 code unit, which files every accented
 * name after every unaccented one. Ordering is a domain decision, so it is
 * applied here rather than left to the store.
 */
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function byName(a: Exercise, b: Exercise): number {
  return collator.compare(a.name, b.name);
}
