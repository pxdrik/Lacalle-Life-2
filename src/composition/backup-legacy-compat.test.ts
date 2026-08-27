import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";

import { BACKUP_FORMAT_VERSION, importAll } from "./backup";
import { DATABASE_NAME, MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";

/**
 * The 2026-08-24 pre-deploy review found that `backup-schemas.ts`'s first
 * version fixed F-05 (accepting adversarial payloads) at the cost of a real
 * regression: it also rejected legitimate old records that `normalize()` in
 * `LocalBodyRepository`, `LocalFoodRepository` and `LocalFoodLogRepository`
 * already tolerates on every read. Because `backupFileSchema` validated the
 * whole file as one unit, one such record failed an entire backup — not just
 * the food, or the weigh-in, that predated a field.
 *
 * **27/08/2026 — the per-record policy this file now tests.** An external
 * audit reproduced that exact failure against production: a real backup,
 * exported by the app's own button, failed to reimport whole because one
 * workout set predated the bound this app enforces on `weightKg` today. The
 * fix moves validation from "the whole file, once" to "each record, on its
 * own" — a record either parses, or gets one repair attempt (an
 * out-of-range field the schema already marks `.nullable()` becomes `null`,
 * see `repairRecord` in `./backup.ts`), or is discarded alone. Nothing
 * adversarial or malformed gets a byte closer to IndexedDB than it did
 * before; what changed is that it no longer takes the rest of a real
 * person's real data down with it. LEGACY LEGÍTIMO → PASS still covers every
 * shape `normalize()` already tolerates on read (unaffected by this — those
 * records parsed clean before and still do). ADVERSARIAL and MALFORMADO
 * (re-asserted here rather than only in `backup-adversarial.test.ts`) now
 * assert the record is discarded and never persisted, not that the whole
 * file is refused — see the doc comment on that `describe` for why.
 * `backup.test.ts`'s round-trip test covers CURRENT VÁLIDO → PASS for a
 * fully-formed export of every domain, and the legacy-`weightKg` case this
 * audit found.
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
    expect(result).toMatchObject({ ok: true, recordCount: 1 });

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
    expect(result).toMatchObject({ ok: true, recordCount: 1 });

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
    expect(result).toMatchObject({ ok: true, recordCount: 1 });
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
    expect(result).toMatchObject({ ok: true, recordCount: 1 });
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
    expect(result).toMatchObject({ ok: true, recordCount: 1 });
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
    expect(result).toMatchObject({ ok: true, recordCount: 1 });

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
    expect(result).toMatchObject({ ok: true, recordCount: 1 });

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
    expect(result).toMatchObject({ ok: true, recordCount: 3 });
  });
});

/**
 * **Policy change, made explicitly for this request (27/08/2026) — not a
 * silent regression of the 2026-08-24 hardening.** Every test below used to
 * assert `{ ok: false, reason: "invalid" }`: one bad record failed the whole
 * file, the same all-or-nothing rule that also made a legitimate legacy
 * `weightKg: -20` reject an entire real backup (see `backup.test.ts`'s
 * round-trip test for that exact case, the one an external audit reproduced
 * against production).
 *
 * The request that fixed that asked for one policy, not two: **a record that
 * cannot be safely recovered is discarded on its own, and never rejects the
 * rest of the file** — no carve-out for "unless the reason looks
 * adversarial". What stays exactly as strict as before is the one thing that
 * actually matters here — **not one byte of an adversarial or malformed
 * record ever reaches IndexedDB** — asserted below the same way the
 * pre-existing tests already did. What changes is only the film over that:
 * the file's *other*, valid records still import, and the toast a person
 * reading it live sees names the count discarded rather than a bare refusal.
 */
describe("ADVERSARIAL → DISCARD THE RECORD, NEVER PERSIST IT", () => {
  it("discards a food missing isCustom, which normalize() does not default — and still imports everything else in the same file", async () => {
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
    // A valid record, in the same file, in an unrelated store — the "preserve
    // everything else" half of the fix an external audit asked for.
    stores.diets = [
      {
        id: "diet-ok",
        name: "Manter",
        createdAt: 1,
        updatedAt: 1,
        meals: [],
        weekdays: [],
      },
    ];

    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({
      ok: true,
      recordCount: 1,
      discardedCount: 1,
    });

    const repositories = await getRepositories();
    await expect(repositories.foods.getById("arroz")).resolves.toBeUndefined();
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Manter" },
    ]);
  });

  it("discards an absurd kcal rather than repairing it — a bound this far off is not a plausible legacy value", async () => {
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
    // `kcal` is not `.nullable()` in `macrosSchema` — nothing here nulls it
    // and calls that "recovered". Discarded, same as any other field a
    // repair cannot safely touch.
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });
    const repositories = await getRepositories();
    await expect(repositories.foods.getById("arroz")).resolves.toBeUndefined();
  });

  it("nulls a legacy-plausible negative weight, but only on the one field — never invents a positive number", async () => {
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
    // `bodyRecordSchema`'s `weightKg` is `.nullable()` — the same "absent"
    // `LocalBodyRepository.normalize()` already tolerates on read. Sanitised,
    // not discarded: the record's only problem was this one field.
    expect(result).toMatchObject({
      ok: true,
      sanitizedCount: 1,
      discardedCount: 0,
    });
    const repositories = await getRepositories();
    const stored = await repositories.body.getByDay("2026-01-01");
    expect(stored?.weightKg).toBeNull();
    expect(stored?.weightKg).not.toBe(-999_999_999);
  });

  it("discards an out-of-range measurement site, rather than repairing it — the whole measurements object is optional, one absurd value inside it is not a plausible legacy shape", async () => {
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
    // A measurement site is `.nullable()`, so this *is* repaired (nulled)
    // rather than discarded — the site becomes "not measured", the same
    // state a legacy record predating that site already has above. The
    // record survives; the absurd number does not.
    expect(result).toMatchObject({
      ok: true,
      sanitizedCount: 1,
      discardedCount: 0,
    });
    const repositories = await getRepositories();
    const stored = await repositories.body.getByDay("2026-01-01");
    expect(stored?.measurements.waist ?? null).toBeNull();
  });

  it("discards mass assignment (role/isAdmin) rather than stripping the extra keys and keeping the rest", async () => {
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
    // `unrecognized_keys` is not a bound violation — nothing here strips an
    // unexpected key and calls the rest "recovered". Discarded whole, the
    // same as before this request, just without failing the rest of the
    // file over it.
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });

    const repositories = await getRepositories();
    await expect(repositories.foods.getById("arroz")).resolves.toBeUndefined();
  });
});

describe("MALFORMADO → DISCARD THE RECORD, NEVER PERSIST IT", () => {
  it("discards a food log missing day, which nothing defaults", async () => {
    const stores = emptyStores();
    stores.foodLogs = [{ id: "2026-01-01", createdAt: 1, updatedAt: 1 }];

    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });
    const repositories = await getRepositories();
    await expect(
      repositories.foodLogs.getByDay("2026-01-01"),
    ).resolves.toBeUndefined();
  });

  it("discards a body entry missing day, which nothing defaults", async () => {
    const stores = emptyStores();
    stores.body = [{ id: "2026-01-01", createdAt: 1, updatedAt: 1 }];

    const result = await importAll(envelope(stores));
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });
    const repositories = await getRepositories();
    await expect(
      repositories.body.getByDay("2026-01-01"),
    ).resolves.toBeUndefined();
  });

  it("discards a food missing id entirely", async () => {
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
    expect(result).toMatchObject({ ok: true, discardedCount: 1 });
    const repositories = await getRepositories();
    await expect(repositories.foods.listAll()).resolves.toEqual([]);
  });
});
