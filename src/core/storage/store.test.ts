import { beforeEach, describe, expect, it } from "vitest";

import { DataError } from "@/core/domain/data-error";
import type { Entity } from "@/core/domain/entity";

import { openDatabase } from "./indexeddb/database";
import { IndexedDbStore } from "./indexeddb/indexeddb-store";
import { MemoryStore } from "./memory-store";
import type { Migration, StoreDefinition } from "./schema";
import type { IndexQuery, Store } from "./store";

/**
 * One suite, both adapters.
 *
 * This is what makes the persistence boundary real: a behaviour that only one
 * implementation has fails here rather than showing up as a bug the day the
 * adapter is swapped.
 */

interface TestRecord extends Entity {
  name: string;
  /** Optional on purpose — proves records missing an indexed field are
   *  absent from that index rather than sorting as `undefined`. */
  category?: string;
  score: number;
}

const TEST_STORE: StoreDefinition = {
  name: "records",
  keyPath: "id",
  indexes: [
    { name: "byCategory", keyPath: "category" },
    { name: "byScore", keyPath: "score" },
  ],
};

const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "test schema", createStores: [TEST_STORE] },
];

function record(overrides: Partial<TestRecord> & { id: string }): TestRecord {
  return {
    createdAt: 1_000,
    updatedAt: 1_000,
    name: `record ${overrides.id}`,
    score: 0,
    ...overrides,
  };
}

let databaseCounter = 0;

const ADAPTERS: readonly {
  name: string;
  create: () => Promise<Store<TestRecord>>;
}[] = [
  {
    name: "MemoryStore",
    create: () => Promise.resolve(new MemoryStore<TestRecord>(TEST_STORE)),
  },
  {
    name: "IndexedDbStore",
    create: async () => {
      databaseCounter += 1;
      const db = await openDatabase(`conformance-${databaseCounter}`, MIGRATIONS);
      return new IndexedDbStore<TestRecord>(db, TEST_STORE.name);
    },
  },
];

describe.each(ADAPTERS)("Store contract — $name", ({ create }) => {
  let store: Store<TestRecord>;

  beforeEach(async () => {
    store = await create();
  });

  describe("get / put", () => {
    it("returns undefined for an id that was never written", async () => {
      await expect(store.get("missing")).resolves.toBeUndefined();
    });

    it("round-trips a record", async () => {
      const written = record({ id: "a", name: "Frango", score: 31 });
      await store.put(written);

      await expect(store.get("a")).resolves.toEqual(written);
    });

    it("replaces on write to an existing id", async () => {
      await store.put(record({ id: "a", name: "before" }));
      await store.put(record({ id: "a", name: "after" }));

      await expect(store.get("a")).resolves.toMatchObject({ name: "after" });
      await expect(store.count()).resolves.toBe(1);
    });
  });

  describe("structured clone semantics", () => {
    it("does not keep a reference to the object it was given", async () => {
      const written = record({ id: "a", name: "original" });
      await store.put(written);
      written.name = "mutated after write";

      await expect(store.get("a")).resolves.toMatchObject({
        name: "original",
      });
    });

    it("hands out an independent copy on every read", async () => {
      await store.put(record({ id: "a", name: "original" }));

      const first = await store.get("a");
      expect(first).toBeDefined();
      first!.name = "mutated after read";

      await expect(store.get("a")).resolves.toMatchObject({
        name: "original",
      });
    });
  });

  describe("getAll", () => {
    it("returns an empty array for an empty store", async () => {
      await expect(store.getAll()).resolves.toEqual([]);
    });

    it("orders by primary key, not insertion order", async () => {
      await store.put(record({ id: "c" }));
      await store.put(record({ id: "a" }));
      await store.put(record({ id: "b" }));

      const ids = (await store.getAll()).map((r) => r.id);
      expect(ids).toEqual(["a", "b", "c"]);
    });
  });

  describe("putMany", () => {
    it("writes every record", async () => {
      await store.putMany([
        record({ id: "a" }),
        record({ id: "b" }),
        record({ id: "c" }),
      ]);

      await expect(store.count()).resolves.toBe(3);
    });

    it("accepts an empty batch", async () => {
      await expect(store.putMany([])).resolves.toBeUndefined();
      await expect(store.count()).resolves.toBe(0);
    });
  });

  describe("remove / clear", () => {
    it("removes a single record", async () => {
      await store.putMany([record({ id: "a" }), record({ id: "b" })]);
      await store.remove("a");

      await expect(store.get("a")).resolves.toBeUndefined();
      await expect(store.get("b")).resolves.toBeDefined();
    });

    it("treats removing an absent id as a no-op", async () => {
      await expect(store.remove("never-existed")).resolves.toBeUndefined();
    });

    it("empties the store", async () => {
      await store.putMany([record({ id: "a" }), record({ id: "b" })]);
      await store.clear();

      await expect(store.count()).resolves.toBe(0);
    });
  });

  describe("getAllByIndex", () => {
    beforeEach(async () => {
      await store.putMany([
        record({ id: "a", category: "protein", score: 30 }),
        record({ id: "b", category: "carb", score: 10 }),
        record({ id: "c", category: "protein", score: 20 }),
        // No category: present in the store, absent from `byCategory`.
        record({ id: "d", score: 40 }),
      ]);
    });

    it("matches an exact key", async () => {
      const found = await store.getAllByIndex("byCategory", {
        equals: "protein",
      });

      expect(found.map((r) => r.id)).toEqual(["a", "c"]);
    });

    it("orders by index value", async () => {
      const found = await store.getAllByIndex("byScore", {});
      expect(found.map((r) => r.score)).toEqual([10, 20, 30, 40]);
    });

    it("excludes records with no value for the indexed field", async () => {
      const found = await store.getAllByIndex("byCategory", {});
      expect(found.map((r) => r.id)).not.toContain("d");
      expect(found).toHaveLength(3);
    });

    it("applies an inclusive lower bound", async () => {
      const found = await store.getAllByIndex("byScore", { from: 20 });
      expect(found.map((r) => r.score)).toEqual([20, 30, 40]);
    });

    it("applies an inclusive upper bound", async () => {
      const found = await store.getAllByIndex("byScore", { to: 20 });
      expect(found.map((r) => r.score)).toEqual([10, 20]);
    });

    it("applies an inclusive range", async () => {
      const found = await store.getAllByIndex("byScore", { from: 20, to: 30 });
      expect(found.map((r) => r.score)).toEqual([20, 30]);
    });

    it("returns an empty array when nothing matches", async () => {
      const found = await store.getAllByIndex("byCategory", {
        equals: "nonexistent",
      });
      expect(found).toEqual([]);
    });

    it("rejects with a DataError for an unknown index", async () => {
      await expect(
        store.getAllByIndex("byNothing", { equals: "x" }),
      ).rejects.toBeInstanceOf(DataError);
    });
  });
});

describe("IndexQuery", () => {
  /**
   * A type-level regression guard. If the union ever loosens back into a
   * plain interface, `@ts-expect-error` becomes unused and `tsc` fails — so
   * the guarantee is checked by the build, not just asserted in a comment.
   */
  it("cannot combine an exact match with a range", () => {
    // @ts-expect-error `equals` and `from` are mutually exclusive.
    const invalid: IndexQuery = { equals: 10, from: 20 };

    expect(invalid).toBeDefined();
  });

  it("accepts each valid shape", () => {
    const shapes: IndexQuery[] = [
      {},
      { equals: "protein" },
      { from: 10 },
      { to: 10 },
      { from: 10, to: 20 },
    ];

    expect(shapes).toHaveLength(5);
  });
});
