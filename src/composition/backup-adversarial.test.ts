import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { createDiet } from "@/features/diet/services/create-diet";

import { BACKUP_FORMAT_VERSION, importAll, previewImport } from "./backup";
import { DATABASE_NAME, MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";

/**
 * Every payload here reproduces a step from the 2026-08-24 adversarial audit
 * against production (`https://lacalle-life-2.vercel.app`), which found the
 * importer accepted all of it: `kcal: 999999999`, `weightKg: -999999999`, a
 * 50 000-character name, `role: "admin"`/`isAdmin: true` written verbatim, and
 * — critically — a `bodyEntries` record shaped nothing like `BodyEntry`, which
 * crashed `/evolucao` with `Cannot read properties of undefined (reading
 * 'split')` once imported.
 *
 * These tests assert the opposite: every one of these files is rejected
 * before any IndexedDB transaction opens, and whatever existed before the
 * import attempt is still there afterward.
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

/** Asserts a payload is rejected and the sentinel diet survived untouched. */
async function expectRejectedAndUntouched(payload: unknown) {
  const repositories = await getRepositories();
  await repositories.diets.save(createDiet("Sentinel"), null);

  const result = await importAll(payload);
  expect(result.ok).toBe(false);

  await expect(repositories.diets.listAll()).resolves.toMatchObject([
    { name: "Sentinel" },
  ]);
}

describe("import rejects the exact payloads the production audit used", () => {
  it("a bodyEntries record shaped nothing like BodyEntry — the payload that crashed /evolucao", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "AUDIT_EXTREME_BODY_1",
        // No `day` at all — `formatDay`/`formatShortDay` call `.split("-")`
        // on it and this is exactly what made that throw in production.
        weightKg: -999_999_999,
        bodyFatPct: 250, // wrong field name too: the real one is bodyFatPercent
        measurements: {},
        notes: "AUDIT_EXTREME_NOTE",
        date: "2026-08-24", // wrong field name: the real one is `day`
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("kcal absurdly large, negative protein, and a giant carbs value on a food", async () => {
    const stores = emptyStores();
    stores.foods = [
      {
        id: "AUDIT_EXTREME_FOOD_1",
        name: "A".repeat(50_000),
        category: "fruit",
        per100g: { kcal: 999_999_999, proteinG: -500, carbsG: 1e308, fatG: 0 },
        createdAt: 1,
        updatedAt: 1,
        isCustom: true,
        isFavorite: false,
      },
    ];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("mass assignment: role/isAdmin on a food record no longer reaches storage", async () => {
    const stores = emptyStores();
    stores.foods = [
      {
        id: "food-1",
        name: "Ovo",
        category: "protein",
        per100g: { kcal: 155, proteinG: 13, carbsG: 1, fatG: 11 },
        createdAt: 1,
        updatedAt: 1,
        isCustom: true,
        isFavorite: false,
        role: "admin",
        isAdmin: true,
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toEqual({ ok: false, reason: "invalid" });

    const repositories = await getRepositories();
    await expect(repositories.foods.getById("food-1")).resolves.toBeUndefined();
  });

  it("negative weight on a well-formed bodyEntries record", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "2026-08-24",
        day: "2026-08-24",
        weightKg: -999_999_999,
        bodyFatPercent: null,
        measurements: {},
        notes: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("an absurdly large, well-typed number (1e308) fails the bound even though it is finite", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "2026-08-24",
        day: "2026-08-24",
        weightKg: 1e308,
        bodyFatPercent: null,
        measurements: {},
        notes: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("a store missing entirely", async () => {
    const stores = emptyStores() as Partial<ReturnType<typeof emptyStores>>;
    delete stores.foods;

    await expectRejectedAndUntouched(envelope(stores as ReturnType<typeof emptyStores>));
  });

  it("a record with no id", async () => {
    const stores = emptyStores();
    stores.diets = [{ name: "sem id", createdAt: 1, updatedAt: 1, meals: [], weekdays: [] }];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("a record with an id of the wrong type", async () => {
    const stores = emptyStores();
    stores.diets = [
      { id: 12345, name: "id numérico", createdAt: 1, updatedAt: 1, meals: [], weekdays: [] },
    ];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("an invalid enum value (food category)", async () => {
    const stores = emptyStores();
    stores.foods = [
      {
        id: "food-1",
        name: "Ovo",
        category: "not-a-real-category",
        per100g: { kcal: 155, proteinG: 13, carbsG: 1, fatG: 11 },
        createdAt: 1,
        updatedAt: 1,
        isCustom: true,
        isFavorite: false,
      },
    ];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("an invalid day format", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "not-a-date",
        day: "24/08/2026", // not YYYY-MM-DD
        weightKg: null,
        bodyFatPercent: null,
        measurements: {},
        notes: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("an invalid nested object (a meal item with a non-finite macro)", async () => {
    const stores = emptyStores();
    stores.diets = [
      {
        id: "diet-1",
        name: "Bulking",
        createdAt: 1,
        updatedAt: 1,
        weekdays: [],
        meals: [
          {
            id: "meal-1",
            name: "Refeição 1",
            time: null,
            notes: "",
            items: [
              {
                id: "item-1",
                foodId: null,
                name: "Arroz",
                grams: 100,
                unit: "g",
                per100g: { kcal: 130, proteinG: 2.7, carbsG: Number.NaN, fatG: 0.3 },
              },
            ],
          },
        ],
      },
    ];

    // `Number.NaN` cannot round-trip through `JSON.stringify` (it becomes
    // `null`), so this is passed as the parsed object `importAll` also
    // accepts directly — proving the schema itself rejects `NaN`, not just
    // JSON's own inability to encode it.
    await expectRejectedAndUntouched(envelope(stores));
  });

  it("Infinity on a numeric field, passed as a parsed object (JSON itself cannot encode it)", async () => {
    const stores = emptyStores();
    stores.routines = [
      {
        id: "routine-1",
        name: "Push A",
        notes: "",
        createdAt: 1,
        updatedAt: 1,
        exercises: [
          {
            id: "ex-1",
            exerciseId: "some-exercise",
            name: "Supino",
            sets: [{ id: "set-1", reps: 8, weightKg: Number.POSITIVE_INFINITY, rpe: null }],
            restSeconds: null,
            notes: "",
          },
        ],
      },
    ];

    await expectRejectedAndUntouched(envelope(stores));
  });

  it("an unknown store key is silently ignored, not written — no object store is created for it", async () => {
    const stores = emptyStores() as Record<string, unknown>;
    stores.maliciousStore = [{ id: "x", createdAt: 1, updatedAt: 1, evil: true }];

    const result = await importAll(envelope(stores as ReturnType<typeof emptyStores>));
    expect(result).toEqual({ ok: true, recordCount: 0 });

    const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
    expect(db.objectStoreNames.contains("maliciousStore")).toBe(false);
  });

  it("previewImport rejects the same crash payload importAll does, without writing anything", async () => {
    const stores = emptyStores();
    stores.body = [
      {
        id: "AUDIT_EXTREME_BODY_1",
        weightKg: -999_999_999,
        date: "2026-08-24",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    expect(previewImport(envelope(stores))).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
