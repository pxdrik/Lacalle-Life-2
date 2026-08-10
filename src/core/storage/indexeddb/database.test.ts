import { describe, expect, it } from "vitest";

import { DataError } from "@/core/domain/data-error";
import type { Entity } from "@/core/domain/entity";

import { databaseVersion, sortedMigrations, type Migration } from "../schema";
import { openDatabase } from "./database";
import { IndexedDbStore } from "./indexeddb-store";

interface Row extends Entity {
  label: string;
  day: string;
}

const V1: Migration = {
  version: 1,
  description: "meals",
  createStores: [{ name: "meals", keyPath: "id", indexes: [] }],
};

let counter = 0;
const uniqueName = () => `migrations-${(counter += 1)}`;

function row(id: string, day = "2026-08-04"): Row {
  return { id, createdAt: 1, updatedAt: 1, label: `row ${id}`, day };
}

describe("databaseVersion", () => {
  it("is 1 when no migrations are declared", () => {
    expect(databaseVersion([])).toBe(1);
  });

  it("is the highest declared version", () => {
    expect(databaseVersion([V1, { version: 7, description: "x" }])).toBe(7);
  });

  it("ignores the order migrations are declared in", () => {
    const out = sortedMigrations([{ version: 3, description: "c" }, V1]);
    expect(out.map((m) => m.version)).toEqual([1, 3]);
  });
});

describe("openDatabase", () => {
  it("creates the stores a migration declares", async () => {
    const db = await openDatabase(uniqueName(), [V1]);

    expect([...db.objectStoreNames]).toEqual(["meals"]);
    expect(db.version).toBe(1);
    db.close();
  });

  it("opens an empty database when nothing is declared", async () => {
    const db = await openDatabase(uniqueName(), []);

    expect([...db.objectStoreNames]).toEqual([]);
    expect(db.version).toBe(1);
    db.close();
  });

  it("preserves existing data when a later migration adds a store", async () => {
    const name = uniqueName();

    const before = await openDatabase(name, [V1]);
    await new IndexedDbStore<Row>(before, "meals").put(row("keep-me"));
    before.close();

    const after = await openDatabase(name, [
      V1,
      {
        version: 2,
        description: "workouts",
        createStores: [{ name: "workouts", keyPath: "id", indexes: [] }],
      },
    ]);

    expect([...after.objectStoreNames].sort()).toEqual(["meals", "workouts"]);
    expect(after.version).toBe(2);
    await expect(
      new IndexedDbStore<Row>(after, "meals").get("keep-me"),
    ).resolves.toMatchObject({ label: "row keep-me" });
    after.close();
  });

  it("runs every pending migration when upgrading across versions", async () => {
    const name = uniqueName();

    const v1 = await openDatabase(name, [V1]);
    v1.close();

    const migrations: readonly Migration[] = [
      V1,
      {
        version: 2,
        description: "sessions",
        createStores: [{ name: "sessions", keyPath: "id", indexes: [] }],
      },
      {
        version: 3,
        description: "measurements",
        createStores: [{ name: "measurements", keyPath: "id", indexes: [] }],
      },
    ];

    const latest = await openDatabase(name, migrations);
    expect([...latest.objectStoreNames].sort()).toEqual([
      "meals",
      "measurements",
      "sessions",
    ]);
    latest.close();
  });

  it("adds an index to a store that already holds data", async () => {
    const name = uniqueName();

    const before = await openDatabase(name, [V1]);
    await new IndexedDbStore<Row>(before, "meals").putMany([
      row("a", "2026-08-01"),
      row("b", "2026-08-05"),
    ]);
    before.close();

    const after = await openDatabase(name, [
      V1,
      {
        version: 2,
        description: "index meals by day",
        addIndexes: [
          { store: "meals", index: { name: "byDay", keyPath: "day" } },
        ],
      },
    ]);

    const found = await new IndexedDbStore<Row>(after, "meals").getAllByIndex(
      "byDay",
      { from: "2026-08-02" },
    );
    expect(found.map((r) => r.id)).toEqual(["b"]);
    after.close();
  });

  it("drops a store", async () => {
    const name = uniqueName();

    const before = await openDatabase(name, [V1]);
    before.close();

    const after = await openDatabase(name, [
      V1,
      { version: 2, description: "drop meals", dropStores: ["meals"] },
    ]);

    expect([...after.objectStoreNames]).toEqual([]);
    after.close();
  });

  it("is idempotent when reopening at the same version", async () => {
    const name = uniqueName();

    const first = await openDatabase(name, [V1]);
    first.close();
    const second = await openDatabase(name, [V1]);

    expect([...second.objectStoreNames]).toEqual(["meals"]);
    expect(second.version).toBe(1);
    second.close();
  });
});

describe("error normalisation", () => {
  it("reports an unknown store as a DataError", async () => {
    const db = await openDatabase(uniqueName(), [V1]);
    const store = new IndexedDbStore<Row>(db, "does-not-exist");

    await expect(store.getAll()).rejects.toBeInstanceOf(DataError);
    db.close();
  });
});
