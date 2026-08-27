import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";

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
 * **27/08/2026 — what "rejected" means changed, not whether these payloads
 * are dangerous.** A separate external audit found the opposite failure mode
 * hiding behind the fix for this one: because the whole file was validated as
 * one unit, a single *legitimate* legacy value (`weightKg: -20` on a workout
 * set from before this app enforced that bound) failed an entire real
 * backup. The importer now validates record by record — a record that
 * cannot be parsed gets one repair attempt (an out-of-range field the schema
 * already marks `.nullable()` becomes `null`, nothing else), and either that
 * succeeds or the record alone is discarded. **Every payload below still
 * never reaches IndexedDB in the form the audit sent it** — that assertion
 * is what actually matters and every test below still makes it directly.
 * What changed is only which of two outcomes proves it: a `kcal` bound is
 * not `.nullable()`, so an absurd one still discards the whole record
 * (`ok: true, discardedCount: 1`); a `weightKg` bound *is* `.nullable()`, so
 * an absurd one is repaired to `null` instead (`ok: true, sanitizedCount: 1`)
 * — and the number that reaches storage is never negative, never the
 * original extreme value, and never invented.
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

describe("import discards the exact payloads the production audit used, without persisting any of them", () => {
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

    const result = await importAll(envelope(stores));
    // Missing `day` is not a bound violation anywhere — nothing repairs a
    // required field being entirely absent. Discarded whole.
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(
      repositories.body.getByDay("2026-08-24"),
    ).resolves.toBeUndefined();
    await expect(repositories.body.listAll()).resolves.toEqual([]);
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

    const result = await importAll(envelope(stores));
    // `macrosSchema`'s four fields are bounded but none is `.nullable()` —
    // a food's calories are not an optional-in-the-domain concept the way a
    // set's weight is. Three fields out of range, none repairable: discarded.
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(
      repositories.foods.getById("AUDIT_EXTREME_FOOD_1"),
    ).resolves.toBeUndefined();
  });

  it("mass assignment: role/isAdmin on a food record still never reaches storage", async () => {
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
    // `unrecognized_keys` is never a bound violation — an extra field is not
    // "fixed" by nulling something. Discarded whole, same as before this
    // change; only the file around it still imports now.
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.foods.getById("food-1")).resolves.toBeUndefined();
  });

  it("negative weight on a well-formed bodyEntries record is repaired to absent, never persisted negative", async () => {
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

    const result = await importAll(envelope(stores));
    // Unlike a food's `kcal`, `bodyRecordSchema`'s `weightKg` is
    // `.nullable()` — the same "not entered" state a weigh-in already has
    // whenever nobody logged a weight. The record's one problem is
    // repairable, so it is repaired, not discarded.
    expect(result).toMatchObject({
      ok: true,
      sanitizedCount: 1,
      discardedCount: 0,
    });

    const repositories = await getRepositories();
    const stored = await repositories.body.getByDay("2026-08-24");
    // Never negative, never turned positive, never invented — absent.
    expect(stored?.weightKg).toBeNull();
    expect(stored?.weightKg).not.toBe(-999_999_999);
  });

  it("an absurdly large, well-typed number (1e308) is repaired the same way — finite is not the same as plausible", async () => {
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

    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({
      ok: true,
      sanitizedCount: 1,
      discardedCount: 0,
    });

    const repositories = await getRepositories();
    const stored = await repositories.body.getByDay("2026-08-24");
    expect(stored?.weightKg).toBeNull();
  });

  /**
   * The one case that still fails the whole file — deliberately. A missing
   * *store* is not a bad record inside an otherwise-readable file; it means
   * the envelope itself is not shaped like a backup, and no per-record
   * repair belongs anywhere near that decision. `backupEnvelopeSchema` in
   * `./backup.ts` is the check this exercises.
   */
  it("a store missing entirely still rejects the whole file", async () => {
    const repositories = await getRepositories();
    const { createDiet } = await import("@/features/diet/services/create-diet");
    await repositories.diets.save(createDiet("Sentinel"), null);

    const stores = emptyStores() as Partial<ReturnType<typeof emptyStores>>;
    delete stores.foods;

    const result = await importAll(envelope(stores as ReturnType<typeof emptyStores>));
    expect(result).toEqual({ ok: false, reason: "invalid" });
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Sentinel" },
    ]);
  });

  it("a record with no id is discarded, never persisted", async () => {
    const stores = emptyStores();
    stores.diets = [{ name: "sem id", createdAt: 1, updatedAt: 1, meals: [], weekdays: [] }];

    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.diets.listAll()).resolves.toEqual([]);
  });

  it("a record with an id of the wrong type is discarded, never persisted", async () => {
    const stores = emptyStores();
    stores.diets = [
      { id: 12345, name: "id numérico", createdAt: 1, updatedAt: 1, meals: [], weekdays: [] },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.diets.listAll()).resolves.toEqual([]);
  });

  it("an invalid enum value (food category) is discarded, never persisted", async () => {
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

    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.foods.getById("food-1")).resolves.toBeUndefined();
  });

  it("an invalid day format is discarded, never persisted", async () => {
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

    const result = await importAll(envelope(stores));
    // A regex mismatch is not a bound violation — never repaired.
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.body.listAll()).resolves.toEqual([]);
  });

  it("an invalid nested object (a meal item with a non-finite macro) is discarded, never persisted", async () => {
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
    // JSON's own inability to encode it. Zod reports `NaN` as `invalid_type`,
    // not a bound violation, so this is never a repair candidate either.
    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.diets.listAll()).resolves.toEqual([]);
  });

  it("Infinity on a numeric field, passed as a parsed object (JSON itself cannot encode it), is discarded, never persisted", async () => {
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

    // Zod reports `Infinity` as `invalid_type` (see the doc comment on
    // `bounded` in `backup-schemas.ts`), not `too_big` — a repair only ever
    // fires on an in-range-of-being-a-number value that is merely out of
    // bounds, so this is never a candidate either, even though `weightKg`
    // here is `.nullable()`.
    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.routines.listAll()).resolves.toEqual([]);
  });

  it("an unknown store key is silently ignored, not written — no object store is created for it", async () => {
    const stores = emptyStores() as Record<string, unknown>;
    stores.maliciousStore = [{ id: "x", createdAt: 1, updatedAt: 1, evil: true }];

    const result = await importAll(envelope(stores as ReturnType<typeof emptyStores>));
    expect(result).toEqual({
      ok: true,
      recordCount: 0,
      sanitizedCount: 0,
      discardedCount: 0,
    });

    const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
    expect(db.objectStoreNames.contains("maliciousStore")).toBe(false);
  });

  it("previewImport reports the same discard importAll would, without writing anything", async () => {
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

    expect(previewImport(envelope(stores))).toMatchObject({
      ok: true,
      discardedCount: 1,
    });

    const repositories = await getRepositories();
    await expect(repositories.body.listAll()).resolves.toEqual([]);
  });
});
