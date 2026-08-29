import { beforeEach, describe, expect, it } from "vitest";

import { DataError } from "@/core/domain/data-error";
import { revise } from "@/core/domain/entity";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { MemoryStore } from "@/core/storage/memory-store";
import type { Migration } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import { createRoutine } from "../services/create-routine";
import type { Routine } from "../types/routine";
import { LocalRoutineRepository, ROUTINES_STORE } from "./routine-repository";

const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "routines", createStores: [ROUTINES_STORE] },
];

let counter = 0;

const ADAPTERS: readonly {
  name: string;
  create: () => Promise<Store<Routine>>;
}[] = [
  {
    name: "memory",
    create: () => Promise.resolve(new MemoryStore<Routine>(ROUTINES_STORE)),
  },
  {
    name: "indexeddb",
    create: async () => {
      counter += 1;
      const db = await openDatabase(`routines-repo-${counter}`, MIGRATIONS);
      return new IndexedDbStore<Routine>(db, ROUTINES_STORE.name);
    },
  },
];

/**
 * The version-check mechanism itself is exercised generically for both
 * adapters in `core/storage/store.test.ts`. This is the version wired through
 * a real feature repository — the shape BUG-001 was actually reported in —
 * confirmed against real IndexedDB, not only the in-memory adapter.
 */
describe.each(ADAPTERS)("LocalRoutineRepository — $name", ({ create }) => {
  let repository: LocalRoutineRepository;

  beforeEach(async () => {
    repository = new LocalRoutineRepository(await create());
  });

  describe("concurrent writers — BUG-001", () => {
    it("rejects a stale writer instead of silently overwriting the winner", async () => {
      const original = createRoutine("Push A");
      await repository.save(original, null);

      // Two tabs open the same routine and both read `original.updatedAt`.
      const fromTabA = revise(original, { notes: "Edited by A" });
      const fromTabB = revise(original, { notes: "Edited by B" });

      // Tab A saves first.
      await repository.save(fromTabA, original.updatedAt);

      // Tab B still believes the version it originally read — its write must
      // be rejected, not silently win over Tab A's.
      await expect(
        repository.save(fromTabB, original.updatedAt),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const stored = await repository.getById(original.id);
      expect(stored?.notes).toBe("Edited by A");
    });

    it("rejects a second create at the same id", async () => {
      const routine = createRoutine("Push A");

      await repository.save(routine, null);
      await expect(repository.save(routine, null)).rejects.toBeInstanceOf(
        DataError,
      );
    });

    it("lets a valid sequence of successive updates through", async () => {
      const routine = createRoutine("Push A");
      await repository.save(routine, null);

      const v2 = revise(routine, { notes: "v2" });
      await repository.save(v2, routine.updatedAt);

      const v3 = revise(v2, { notes: "v3" });
      await repository.save(v3, v2.updatedAt);

      await expect(repository.getById(routine.id)).resolves.toMatchObject({
        notes: "v3",
      });
    });

    it("rejects a conflicting write aimed at a different, unrelated routine without disturbing it", async () => {
      const a = createRoutine("Push A");
      const b = createRoutine("Pull B");
      await repository.save(a, null);
      await repository.save(b, null);

      await expect(
        repository.save(revise(b, { notes: "stale" }), a.updatedAt),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      await expect(repository.getById(a.id)).resolves.toMatchObject({
        notes: "",
      });
    });
  });

  describe("normalize — backfilling durationSeconds", () => {
    it("defaults a set written before the field existed to null, on both read paths", async () => {
      const store = await create();
      const withRepository = new LocalRoutineRepository(store);

      const routine = createRoutine("Cardio");
      const legacy = {
        ...routine,
        exercises: [
          {
            id: "ex1",
            exerciseId: "esteira",
            name: "Esteira",
            restSeconds: null,
            notes: "",
            sets: [{ id: "set1", reps: null, weightKg: null, rpe: null }],
          },
        ],
      };
      // Bypasses the type system on purpose: this is the exact shape an
      // older release actually wrote — no `durationSeconds` key at all, not
      // the key set to `null`, which already describes a row that has been
      // through this code.
      await store.put(legacy as unknown as Routine);

      await expect(
        withRepository.getById(routine.id),
      ).resolves.toMatchObject({
        exercises: [{ sets: [{ durationSeconds: null }] }],
      });

      await expect(withRepository.listAll()).resolves.toMatchObject([
        { exercises: [{ sets: [{ durationSeconds: null }] }] },
      ]);
    });
  });
});
