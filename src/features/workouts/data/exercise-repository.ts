import type { EntityId } from "@/core/domain/entity";
import type { StoreDefinition } from "@/core/storage/schema";

import type { Exercise } from "../types/exercise";

export const EXERCISES_STORE: StoreDefinition = {
  name: "exercises",
  keyPath: "id",
  indexes: [],
};

/**
 * The persistence boundary for exercises.
 *
 * No secondary indexes: the catalogue is read once into memory and searched
 * there, because an index on muscle groups cannot answer "name or alias
 * containing this text, ranked by prefix" anyway.
 */
export interface ExerciseRepository {
  /** Every exercise, curated and user-created, ordered by name (pt-BR). */
  listAll(): Promise<readonly Exercise[]>;

  getById(id: EntityId): Promise<Exercise | undefined>;

  /**
   * `expectedUpdatedAt` is the version this caller last read — `null` for an
   * exercise that has never been saved. Throws `DataError("CONFLICT")`
   * instead of overwriting when the stored version has moved since.
   */
  save(exercise: Exercise, expectedUpdatedAt: number | null): Promise<void>;

  /**
   * Seeds or replaces many records at once, unconditionally — the catalogue
   * import path, not a user edit. There is no "since I last read it" for a
   * bulk seed to compare against.
   */
  saveMany(exercises: readonly Exercise[]): Promise<void>;

  remove(id: EntityId): Promise<void>;

  /** Whether anything has been stored yet. Drives first-run seeding. */
  isEmpty(): Promise<boolean>;
}
