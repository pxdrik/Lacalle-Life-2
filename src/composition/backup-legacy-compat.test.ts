import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { createDiet } from "@/features/diet/services/create-diet";

import { BACKUP_FORMAT_VERSION, importAll } from "./backup";
import { DATABASE_NAME, MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";

/**
 * The 2026-08-24 pre-deploy review found that `backup-schemas.ts`'s first
 * version fixed F-05 (accepting adversarial payloads) at the cost of a real
 * regression: it also rejected legitimate old records that `normalize()` in
 * `LocalBodyRepository`, `LocalFoodRepository` and `LocalFoodLogRepository`
 * already tolerates on every read. Because `backupFileSchema` validates the
 * whole file as one unit, one such record failed an entire backup — not just
 * the food, or the weigh-in, that predated a field.
 *
 * This file is the matrix the review asked for: every legacy shape each
 * `normalize()` proves the app already supports must still import (LEGACY
 * LEGÍTIMO → PASS), every adversarial payload from the Round 2 audit must
 * still be rejected (ADVERSARIAL → REJECT, re-asserted here rather than only
 * in `backup-adversarial.test.ts`, specifically alongside the legacy cases
 * so a future change cannot fix one column without a test noticing it broke
 * the other), and a record missing a field nothing defaults must still be
 * rejected (MALFORMADO → REJECT). `backup.test.ts`'s round-trip test already
 * covers CURRENT VÁLIDO → PASS for a fully-formed export of every domain.
 */

async function clearAllStores() {
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
  const names = [...db.objectStoreNames];
  const tx = db.transaction(names, "readwrite");
  await Promise.all([
    ...names.map((name) => tx.objectStore(name).clear()),
    tx.done,
  ]);
}

function emptyStores() {
  return {
    body: [] as unknown[],
    foodLogs: [] as unknown[],
    foods: [] as unknown[],
    diets: [] as unknown[],
    profile: [] as unknown[],
    exercises: [] as unknown[],
    routines: [] as unknown[],
    sessions: [] as unknown[],
  };
}

function envelope(stores: ReturnType<typeof emptyStores>) {
  return { schemaVersion: BACKUP_FORMAT_VERSION, exportedAt: Date.now(), stores };
}

beforeAll(async () => {
  await getRepositories();
});

beforeEach(async () => {
  await clearAllStores();
});

describe("LEGACY LEGÍTIMO → PASS", () => {
  it("a food from before isFavorite existed", async () => {
    const stores = emptyStores();
    stores.foods = [
      {
        id: "arroz",
        name: "Arroz",
        category: "carb",
        per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        isCustom: false,
        createdAt: 1,
        updatedAt: 1,
        // no isFavorite — exactly what LocalFoodRepository's own
        // "forward compatibility" test constructs and normalize() reads.
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: true, recordCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.foods.getById("arroz")).resolves.toMatchObject({
      isFavorite: false,
    });
  });

  it("a body entry from before notes existed", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        weightKg: 80,
        bodyFatPercent: null,
        measurements: {},
        createdAt: 1,
        updatedAt: 1,
        // no notes
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: true, recordCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.body.getByDay("2026-01-01")).resolves.toMatchObject({
      notes: "",
      weightKg: 80,
    });
  });

  it("a body entry missing the whole measurements object", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        weightKg: null,
        bodyFatPercent: null,
        notes: "",
        createdAt: 1,
        updatedAt: 1,
        // no measurements at all
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: true, recordCount: 1 });
  });

  it("a body entry missing one measurement site added after it was written", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        weightKg: null,
        bodyFatPercent: null,
        notes: "",
        // every site except "calf", as if it were added to the taxonomy later
        measurements: {
          neck: null,
          chest: null,
          arm: null,
          forearm: null,
          waist: 82,
          abdomen: null,
          hip: null,
          thigh: null,
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: true, recordCount: 1 });
  });

  it("a body entry missing weightKg and bodyFatPercent entirely", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        notes: "",
        measurements: {},
        createdAt: 1,
        updatedAt: 1,
        // no weightKg, no bodyFatPercent
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: true, recordCount: 1 });
  });

  it("a food log from before dietId existed", async () => {
    const stores = emptyStores();
    stores.foodLogs = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        meals: [],
        createdAt: 1,
        updatedAt: 1,
        // no dietId
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: true, recordCount: 1 });

    const repositories = await getRepositories();
    await expect(
      repositories.foodLogs.getByDay("2026-01-01"),
    ).resolves.toMatchObject({ dietId: null });
  });

  it("a food log from before meals existed as a field", async () => {
    const stores = emptyStores();
    stores.foodLogs = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        dietId: null,
        createdAt: 1,
        updatedAt: 1,
        // no meals
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: true, recordCount: 1 });

    const repositories = await getRepositories();
    await expect(
      repositories.foodLogs.getByDay("2026-01-01"),
    ).resolves.toMatchObject({ meals: [] });
  });

  it("a food, a body entry and a food log all missing their legacy fields, in the same backup", async () => {
    const stores = emptyStores();
    stores.foods = [
      {
        id: "arroz",
        name: "Arroz",
        category: "carb",
        per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        isCustom: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    stores.body = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    stores.foodLogs = [
      { id: "2026-01-01", day: "2026-01-01", createdAt: 1, updatedAt: 1 },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: true, recordCount: 3 });
  });
});

describe("ADVERSARIAL → REJECT (re-asserted alongside the legacy matrix)", () => {
  it("still rejects a food missing isCustom, which normalize() does not default", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Sentinel"), null);

    const stores = emptyStores();
    stores.foods = [
      {
        id: "arroz",
        name: "Arroz",
        category: "carb",
        per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        createdAt: 1,
        updatedAt: 1,
        // no isCustom — unlike isFavorite, nothing tolerates this being absent
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Sentinel" },
    ]);
  });

  it("still rejects an absurd kcal even with isFavorite legitimately absent", async () => {
    const stores = emptyStores();
    stores.foods = [
      {
        id: "arroz",
        name: "Arroz",
        category: "carb",
        per100g: { kcal: 999_999_999, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        isCustom: false,
        createdAt: 1,
        updatedAt: 1,
        // isFavorite absent — legitimate on its own, must not mask the kcal bound
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("still rejects a negative weight even with notes legitimately absent", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        weightKg: -999_999_999,
        createdAt: 1,
        updatedAt: 1,
        // notes absent — legitimate on its own, must not mask the weight bound
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("still rejects an out-of-range measurement even when the site key is otherwise optional", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "2026-01-01",
        day: "2026-01-01",
        measurements: { waist: 999_999 },
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("still rejects mass assignment (role/isAdmin) on a food with isFavorite legitimately absent", async () => {
    const stores = emptyStores();
    stores.foods = [
      {
        id: "arroz",
        name: "Arroz",
        category: "carb",
        per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        isCustom: false,
        createdAt: 1,
        updatedAt: 1,
        role: "admin",
        isAdmin: true,
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });

    const repositories = await getRepositories();
    await expect(repositories.foods.getById("arroz")).resolves.toBeUndefined();
  });
});

describe("MALFORMADO → REJECT", () => {
  it("still rejects a food log missing day, which nothing defaults", async () => {
    const stores = emptyStores();
    stores.foodLogs = [{ id: "2026-01-01", createdAt: 1, updatedAt: 1 }];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("still rejects a body entry missing day, which nothing defaults", async () => {
    const stores = emptyStores();
    stores.body = [{ id: "2026-01-01", createdAt: 1, updatedAt: 1 }];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("still rejects a food missing id entirely", async () => {
    const stores = emptyStores();
    stores.foods = [
      {
        name: "Arroz",
        category: "carb",
        per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        isCustom: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });
});
