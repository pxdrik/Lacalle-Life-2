import { describe, expect, it } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";

import { MIGRATIONS } from "./migrations";
import { createRepositories } from "./repositories";

/**
 * Proves the wiring, using the application's real migration list rather than a
 * test schema — so a store declared in `migrations.ts` under a name a
 * repository does not expect fails here rather than at runtime.
 */
describe("createRepositories", () => {
  it("wires a working foods repository against the real schema", async () => {
    const db = await openDatabase("composition-test", MIGRATIONS);
    const { foods } = createRepositories(db);

    await expect(foods.isEmpty()).resolves.toBe(true);

    await foods.save({
      id: "ovo",
      name: "Ovo",
      category: "protein",
      per100g: { kcal: 143, proteinG: 13, carbsG: 1, fatG: 10 },
      isCustom: false,
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(foods.getById("ovo")).resolves.toMatchObject({ name: "Ovo" });
    db.close();
  });
});

describe("MIGRATIONS", () => {
  it("has no repeated version numbers", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("starts at 1 and leaves no gaps", () => {
    // A gap would still work, but it almost always means an entry was dropped
    // instead of being superseded — and a released version must never vanish.
    const versions = [...MIGRATIONS.map((m) => m.version)].sort((a, b) => a - b);
    expect(versions).toEqual(versions.map((_, index) => index + 1));
  });
});
