import { beforeEach, describe, expect, it } from "vitest";

import { DataError } from "@/core/domain/data-error";
import { revise } from "@/core/domain/entity";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { MemoryStore } from "@/core/storage/memory-store";
import type { Migration } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import { createBodyEntry, EMPTY_MEASUREMENTS } from "../services/body-log";
import type { BodyEntry } from "../types/body-entry";
import { BODY_ENTRIES_STORE } from "./body-repository";
import { LocalBodyRepository } from "./local-body-repository";

let repository: LocalBodyRepository;
let store: MemoryStore<BodyEntry>;

function entry(day: string, over: Partial<BodyEntry> = {}): BodyEntry {
  return { ...createBodyEntry(day), ...over };
}

beforeEach(() => {
  store = new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE);
  repository = new LocalBodyRepository(store);
});

describe("LocalBodyRepository", () => {
  it("returns entries oldest first, whatever order they were written in", async () => {
    await repository.save(entry("2026-08-10"), null);
    await repository.save(entry("2026-07-31"), null);
    await repository.save(entry("2026-08-02"), null);

    expect((await repository.listAll()).map((e) => e.day)).toEqual([
      "2026-07-31",
      "2026-08-02",
      "2026-08-10",
    ]);
  });

  /**
   * Reproduces the 2026-08-24 production crash directly at the layer it
   * actually happened in: a record without `day` — reachable through backup
   * import before `composition/backup-schemas.ts` existed to reject it —
   * made `listAll()`'s sort throw on `undefined.localeCompare`, before
   * `/evolucao` ever got a chance to render anything. Import validation
   * closes the write side; this proves the read side survives a record that
   * predates it, or one written some other way.
   */
  it("does not throw when a stored record has no day", async () => {
    await store.put({
      ...entry("2026-08-10"),
      day: undefined,
    } as unknown as BodyEntry);
    await repository.save(entry("2026-08-02"), null);

    await expect(repository.listAll()).resolves.toHaveLength(2);
  });

  it("replaces the day rather than adding a second entry for it", async () => {
    const first = entry("2026-08-07", { weightKg: 82 });
    await repository.save(first, null);
    await repository.save(
      entry("2026-08-07", { weightKg: 81 }),
      first.updatedAt,
    );

    const all = await repository.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.weightKg).toBe(81);
  });

  it("reads a range inclusively at both ends", async () => {
    for (const day of [
      "2026-07-30",
      "2026-08-01",
      "2026-08-15",
      "2026-09-01",
    ]) {
      await repository.save(entry(day), null);
    }

    const range = await repository.listBetween("2026-08-01", "2026-08-15");

    expect(range.map((e) => e.day)).toEqual(["2026-08-01", "2026-08-15"]);
  });

  it("finds a day by id without needing the index", async () => {
    await repository.save(entry("2026-08-07", { weightKg: 82 }), null);

    expect((await repository.getByDay("2026-08-07"))?.weightKg).toBe(82);
    expect(await repository.getByDay("2026-08-08")).toBeUndefined();
  });

  it("fills in a measurement site added after the entry was written", async () => {
    // The stored record predates the site, so it has no slot for it. Reading
    // it back must still answer for every site — with null, which is the
    // truth — or the form would render an uncontrolled input.
    const { calf: _calf, ...older } = EMPTY_MEASUREMENTS;
    await store.put({
      ...entry("2026-08-07"),
      measurements: older as typeof EMPTY_MEASUREMENTS,
    });

    const read = await repository.getByDay("2026-08-07");

    expect(read?.measurements.calf).toBeNull();
    expect(Object.keys(read?.measurements ?? {})).toHaveLength(
      Object.keys(EMPTY_MEASUREMENTS).length,
    );
  });

  it("removes a day", async () => {
    await repository.save(entry("2026-08-07"), null);
    await repository.remove("2026-08-07");

    expect(await repository.listAll()).toEqual([]);
  });
});

const CONFLICT_MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "body entries", createStores: [BODY_ENTRIES_STORE] },
];

let conflictCounter = 0;

const CONFLICT_ADAPTERS: readonly {
  name: string;
  create: () => Promise<Store<BodyEntry>>;
}[] = [
  {
    name: "memory",
    create: () =>
      Promise.resolve(new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE)),
  },
  {
    name: "indexeddb",
    create: async () => {
      conflictCounter += 1;
      const db = await openDatabase(
        `body-entries-repo-${conflictCounter}`,
        CONFLICT_MIGRATIONS,
      );
      return new IndexedDbStore<BodyEntry>(db, BODY_ENTRIES_STORE.name);
    },
  },
];

describe.each(CONFLICT_ADAPTERS)(
  "LocalBodyRepository concurrent writers — BUG-001 — $name",
  ({ create }) => {
    let conflictRepository: LocalBodyRepository;

    beforeEach(async () => {
      conflictRepository = new LocalBodyRepository(await create());
    });

    it("rejects a stale writer instead of silently overwriting the winner", async () => {
      const original = entry("2026-08-16", { weightKg: 80 });
      await conflictRepository.save(original, null);

      const fromTabA = revise(original, { weightKg: 79.5 });
      const fromTabB = revise(original, { weightKg: 79.8 });

      await conflictRepository.save(fromTabA, original.updatedAt);

      await expect(
        conflictRepository.save(fromTabB, original.updatedAt),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const stored = await conflictRepository.getByDay("2026-08-16");
      expect(stored?.weightKg).toBe(79.5);
    });

    it("rejects a second create at the same day", async () => {
      const first = entry("2026-08-16");

      await conflictRepository.save(first, null);
      await expect(
        conflictRepository.save(first, null),
      ).rejects.toBeInstanceOf(DataError);
    });

    it("lets a valid sequence of successive updates through", async () => {
      const first = entry("2026-08-16", { weightKg: 80 });
      await conflictRepository.save(first, null);

      const v2 = revise(first, { weightKg: 79.5 });
      await conflictRepository.save(v2, first.updatedAt);

      const v3 = revise(v2, { weightKg: 79 });
      await conflictRepository.save(v3, v2.updatedAt);

      await expect(
        conflictRepository.getByDay("2026-08-16"),
      ).resolves.toMatchObject({ weightKg: 79 });
    });
  },
);
