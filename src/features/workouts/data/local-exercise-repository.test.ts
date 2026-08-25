import { beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { MemoryStore } from "@/core/storage/memory-store";
import type { Migration } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import { createCustomExercise } from "../services/create-exercise";
import type { Exercise } from "../types/exercise";
import { EXERCISES_STORE, type ExerciseRepository } from "./exercise-repository";
import { LocalExerciseRepository } from "./local-exercise-repository";

const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "exercises", createStores: [EXERCISES_STORE] },
];

let counter = 0;

const ADAPTERS: readonly {
  name: string;
  create: () => Promise<Store<Exercise>>;
}[] = [
  {
    name: "memory",
    create: () => Promise.resolve(new MemoryStore<Exercise>(EXERCISES_STORE)),
  },
  {
    name: "indexeddb",
    create: async () => {
      counter += 1;
      const db = await openDatabase(`exercises-repo-${counter}`, MIGRATIONS);
      return new IndexedDbStore<Exercise>(db, EXERCISES_STORE.name);
    },
  },
];

/**
 * `save` had no version check at all until the 2026-08-24 adversarial audit
 * against production found the consequence: two tabs open on the same
 * exercise — reached through "favoritar" or through creating one — the
 * second save silently overwrote the first, with no error and no warning.
 * `LocalExerciseRepository.save` now goes through
 * `Store.putIfVersionMatches`, exactly like `LocalDietRepository`.
 */
describe.each(ADAPTERS)("LocalExerciseRepository — $name", ({ create }) => {
  let repository: ExerciseRepository;

  beforeEach(async () => {
    repository = new LocalExerciseRepository(await create());
  });

  it("creates with expected version null, then updates against the version just written", async () => {
    const exercise = createCustomExercise({
      name: "Supino reto",
      primaryMuscles: [],
      equipment: [],
    });

    await repository.save(exercise, null);

    const updated = { ...exercise, isFavorite: true, updatedAt: exercise.updatedAt + 1 };
    await repository.save(updated, exercise.updatedAt);

    await expect(repository.getById(exercise.id)).resolves.toMatchObject({
      isFavorite: true,
    });
  });

  describe("concurrent writers", () => {
    it("rejects a stale writer instead of silently overwriting the winner", async () => {
      const original = createCustomExercise({
        name: "Supino reto",
        primaryMuscles: [],
        equipment: [],
      });
      await repository.save(original, null);

      const fromTabA = { ...original, isFavorite: true, updatedAt: original.updatedAt + 1 };
      const fromTabB = { ...original, name: "Supino inclinado", updatedAt: original.updatedAt + 2 };

      await repository.save(fromTabA, original.updatedAt);

      await expect(
        repository.save(fromTabB, original.updatedAt),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const stored = await repository.getById(original.id);
      expect(stored?.isFavorite).toBe(true);
      expect(stored?.name).toBe("Supino reto");
    });

    it("rejects a second create at the same id", async () => {
      const exercise = createCustomExercise({
        name: "Supino reto",
        primaryMuscles: [],
        equipment: [],
      });

      await repository.save(exercise, null);
      await expect(repository.save(exercise, null)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });
});
