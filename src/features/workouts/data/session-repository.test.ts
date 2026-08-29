import { beforeEach, describe, expect, it } from "vitest";

import { DataError } from "@/core/domain/data-error";
import { revise } from "@/core/domain/entity";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { MemoryStore } from "@/core/storage/memory-store";
import type { Migration } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import {
  createRoutine,
  createRoutineExercise,
} from "../services/create-routine";
import { startSession } from "../services/start-session";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { LocalSessionRepository, SESSIONS_STORE } from "./session-repository";

/** A routine with one real exercise — `createRoutine` alone starts empty. */
function routineWithExercise(): Routine {
  const routine = createRoutine("Push A");
  const exercise = createRoutineExercise({
    exerciseId: "supino-reto",
    name: "Supino reto",
  });
  return revise(routine, { exercises: [exercise] });
}

const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "sessions", createStores: [SESSIONS_STORE] },
];

let counter = 0;

const ADAPTERS: readonly {
  name: string;
  create: () => Promise<Store<Session>>;
}[] = [
  {
    name: "memory",
    create: () => Promise.resolve(new MemoryStore<Session>(SESSIONS_STORE)),
  },
  {
    name: "indexeddb",
    create: async () => {
      counter += 1;
      const db = await openDatabase(`sessions-repo-${counter}`, MIGRATIONS);
      return new IndexedDbStore<Session>(db, SESSIONS_STORE.name);
    },
  },
];

/**
 * BUG-008 is this same mechanism inside one tab: several `apply()` calls in
 * the same React batch are, from the repository's point of view,
 * indistinguishable from two tabs racing — both are "a write whose expected
 * version has already moved". Proving the repository rejects a stale writer
 * here is what makes the hook-level fix in `use-session-runner` meaningful
 * rather than merely untested.
 */
describe.each(ADAPTERS)("LocalSessionRepository — $name", ({ create }) => {
  let repository: LocalSessionRepository;

  beforeEach(async () => {
    repository = new LocalSessionRepository(await create());
  });

  describe("concurrent writers — BUG-001 / BUG-008", () => {
    it("rejects a stale writer instead of silently overwriting the winner", async () => {
      const original = startSession(routineWithExercise());
      await repository.save(original, null);

      // Two rapid writes reading the same version — two tabs, or two `apply()`
      // calls landing in the same React batch, look identical here.
      const fromWriterA = revise(original, {
        exercises: original.exercises.map((exercise, index) =>
          index === 0 ? { ...exercise, notes: "done by A" } : exercise,
        ),
      });
      const fromWriterB = revise(original, {
        exercises: original.exercises.map((exercise, index) =>
          index === 0 ? { ...exercise, notes: "done by B" } : exercise,
        ),
      });

      await repository.save(fromWriterA, original.updatedAt);

      await expect(
        repository.save(fromWriterB, original.updatedAt),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const stored = await repository.getById(original.id);
      expect(stored?.exercises[0]?.notes).toBe("done by A");
    });

    it("rejects a second create at the same id", async () => {
      const session = startSession(createRoutine("Push A"));

      await repository.save(session, null);
      await expect(repository.save(session, null)).rejects.toBeInstanceOf(
        DataError,
      );
    });

    it("lets a valid sequence of successive updates through", async () => {
      const session = startSession(createRoutine("Push A"));
      await repository.save(session, null);

      const finished = revise(session, { finishedAt: session.startedAt + 1 });
      await repository.save(finished, session.updatedAt);

      const reopened = revise(finished, { finishedAt: null });
      await repository.save(reopened, finished.updatedAt);

      await expect(repository.getById(session.id)).resolves.toMatchObject({
        finishedAt: null,
      });
    });
  });

  describe("normalize — backfilling durationSeconds", () => {
    it("defaults a set, and its frozen planned target, written before the field existed", async () => {
      const store = await create();
      const withRepository = new LocalSessionRepository(store);

      const session = startSession(createRoutine("Cardio"));
      const legacy = {
        ...session,
        exercises: [
          {
            id: "ex1",
            exerciseId: "esteira",
            name: "Esteira",
            restSeconds: null,
            notes: "",
            sets: [
              {
                id: "set1",
                reps: null,
                weightKg: null,
                rpe: null,
                isCompleted: false,
                planned: { reps: null, weightKg: null, rpe: null },
              },
            ],
          },
        ],
      };
      // Same reasoning as `routine-repository.test.ts`'s equivalent case: no
      // `durationSeconds` key anywhere, exactly what an older release wrote.
      await store.put(legacy as unknown as Session);

      await expect(
        withRepository.getById(session.id),
      ).resolves.toMatchObject({
        exercises: [
          {
            sets: [{ durationSeconds: null, planned: { durationSeconds: null } }],
          },
        ],
      });
    });
  });
});
