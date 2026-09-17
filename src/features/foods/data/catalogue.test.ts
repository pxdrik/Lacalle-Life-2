import { beforeEach, describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { catalogueEntrySchema } from "../validation/food-schema";
import type { Food } from "../types/food";
import catalogue from "./catalogue.json";
import { refreshFoodPracticalUnits, seedCatalogue } from "./catalogue";
import { FOODS_STORE } from "./food-store";
import { LocalFoodRepository } from "./local-food-repository";

/**
 * The catalogue is validated here, at build time, rather than on every first
 * run in the browser. Same guarantee, no runtime cost — and a malformed
 * catalogue fails CI instead of a stranger's phone.
 */
describe("catalogue.json", () => {
  it("is not empty", () => {
    expect(catalogue.length).toBeGreaterThan(200);
  });

  it("has no duplicate ids", () => {
    const ids = catalogue.map((food) => food.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate names", () => {
    const names = catalogue.map((food) => food.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("matches the schema on every entry", () => {
    const failures = catalogue
      .map((entry) => ({
        entry,
        result: catalogueEntrySchema.safeParse(entry),
      }))
      .filter(({ result }) => !result.success)
      .map(
        ({ entry, result }) => `${entry.name}: ${result.error?.message ?? ""}`,
      );

    expect(failures).toEqual([]);
  });

  it("uses slug ids, so re-seeding is idempotent and diffs stay readable", () => {
    for (const food of catalogue) {
      expect(food.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("states energy within reach of its macros", () => {
    // Atwater (4/4/9) overestimates anything with fibre, which yields ~2 kcal/g
    // rather than 4 — lemon reads 29 but computes to 43. A generous ceiling
    // still catches a transposed or misplaced digit.
    //
    // "Fermento em pó, químico" (baking powder) is the one named exception:
    // its 43.9 g of "carboidrato" is mostly inert starch filler (the raising
    // agent itself, sodium bicarbonate, carries no calories at all), so it
    // reads the same as the lemon case above — real source data, not a typo
    // — confirmed against the 1483-entry import it came from (17/09/2026).
    const KNOWN_LOW_ATWATER = new Set(["Fermento em pó, químico"]);
    const wild = catalogue.filter((food) => {
      if (KNOWN_LOW_ATWATER.has(food.name)) return false;
      const { kcal, proteinG, carbsG, fatG } = food.per100g;
      const atwater = 4 * proteinG + 4 * carbsG + 9 * fatG;
      return Math.abs(atwater - kcal) > 25 && atwater > kcal * 1.6;
    });

    expect(wild.map((f) => f.name)).toEqual([]);
  });
});

describe("seedCatalogue", () => {
  const repository = () =>
    new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));

  it("fills an empty repository", async () => {
    const foods = repository();
    await seedCatalogue(foods);

    expect(await foods.listAll()).toHaveLength(catalogue.length);
  });

  it("marks every seeded food as belonging to the catalogue", async () => {
    const foods = repository();
    await seedCatalogue(foods);

    const all = await foods.listAll();
    expect(all.every((food) => !food.isCustom)).toBe(true);
  });

  it("stamps the entity envelope", async () => {
    const foods = repository();
    await seedCatalogue(foods);

    const [first] = await foods.listAll();
    expect(first?.createdAt).toBeGreaterThan(0);
    expect(first?.updatedAt).toBe(first?.createdAt);
  });

  it("never touches a custom food, even though its id is not in the catalogue", async () => {
    const foods = repository();
    const custom = {
      id: "custom",
      name: "Meu alimento",
      category: "protein" as const,
      unit: "g" as const,
      per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
      isCustom: true,
      isFavorite: false,
      createdAt: 1,
      updatedAt: 1,
    };
    await foods.save(custom, null);

    await seedCatalogue(foods);

    // Seeding now runs regardless of what is already stored — see the note
    // on `seedCatalogue` for why an empty-store-only guard stopped being
    // correct. What must never change is this one row: not its fields, not
    // its existence.
    const all = await foods.listAll();
    expect(all.find((f) => f.id === "custom")).toEqual(custom);
  });

  it("adds only the entries missing from an already-seeded repository", async () => {
    const foods = repository();
    await seedCatalogue(foods);

    // Someone favourited a catalogue food before this release shipped —
    // re-seeding must never reset that.
    const [first] = await foods.listAll();
    await foods.save({ ...first!, isFavorite: true }, first!.updatedAt);

    // Simulates "release ships one more food": the repository now has
    // everything except one catalogue entry.
    const before = await foods.listAll();
    const missing = catalogue.find((entry) => entry.id !== before[0]?.id)!;
    await foods.remove(missing.id);

    await seedCatalogue(foods);

    const after = await foods.listAll();
    expect(after).toHaveLength(catalogue.length);
    expect(after.find((f) => f.id === first!.id)?.isFavorite).toBe(true);
  });
});

describe("refreshFoodPracticalUnits", () => {
  const repository = () =>
    new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));

  /** A catalogue food with a known practical unit. */
  const MAPPED_ID = "abacate";

  beforeEach(() => {
    localStorage.clear();
  });

  it("backfills a catalogue seeded before practical units existed", async () => {
    const foods = repository();
    await seedCatalogue(foods);

    const before = await foods.getById(MAPPED_ID);
    if (before === undefined) throw new Error("fixture ausente");
    // A row as an older release actually left it: no `practicalUnit` key at
    // all, not the key set to `undefined` — that already describes a row
    // that has been through this code.
    const { practicalUnit: _omit, ...withoutUnit } = before;
    await foods.save(withoutUnit as Food, before.updatedAt);

    await refreshFoodPracticalUnits(foods);

    const after = await foods.getById(MAPPED_ID);
    expect(after?.practicalUnit).toEqual(
      catalogue.find((f) => f.id === MAPPED_ID)?.practicalUnit,
    );
  });

  it("writes nothing when the stored unit already matches", async () => {
    const foods = repository();
    await seedCatalogue(foods);
    await refreshFoodPracticalUnits(foods);

    const before = await foods.getById(MAPPED_ID);

    await refreshFoodPracticalUnits(foods);

    const after = await foods.getById(MAPPED_ID);
    expect(after?.updatedAt).toBe(before?.updatedAt);
  });

  it("skips the read entirely once the revision is marked", async () => {
    const foods = repository();
    await seedCatalogue(foods);
    await refreshFoodPracticalUnits(foods);

    const before = await foods.getById(MAPPED_ID);
    if (before === undefined) throw new Error("fixture ausente");
    const { practicalUnit: _omit, ...withoutUnit } = before;
    await foods.save(withoutUnit as Food, before.updatedAt);

    await refreshFoodPracticalUnits(foods);

    const after = await foods.getById(MAPPED_ID);
    expect(after?.practicalUnit).toBeUndefined();
  });

  it("backfills the measurement kind for a food seeded before it existed", async () => {
    const foods = repository();
    await seedCatalogue(foods);

    const before = await foods.getById(MAPPED_ID);
    if (before === undefined) throw new Error("fixture ausente");
    // A row as an older release actually left it: no `unit` key at all.
    const { unit: _omit, ...withoutUnit } = before;
    await foods.save(withoutUnit as Food, before.updatedAt);

    await refreshFoodPracticalUnits(foods);

    const after = await foods.getById(MAPPED_ID);
    expect(after?.unit).toBe(catalogue.find((f) => f.id === MAPPED_ID)?.unit);
  });

  it("leaves a food with no matching catalogue entry untouched", async () => {
    // Not a real catalogue id with a coincidental gap (there is no such gap
    // any more — every entry has both a `unit` and, mostly, a
    // `practicalUnit`) but a fixture standing in for a discontinued entry:
    // one this repository has stored that the current catalogue.json no
    // longer lists at all, so `refreshFoodPracticalUnits` has nothing to
    // compare it against and must leave it exactly as it is.
    const orphan: Food = {
      id: "nao-esta-mais-no-catalogo",
      name: "Alimento descontinuado",
      category: "protein",
      unit: "g",
      per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
      isCustom: false,
      isFavorite: false,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(catalogue.some((food) => food.id === orphan.id)).toBe(false);

    const foods = repository();
    await foods.save(orphan, null);

    await refreshFoodPracticalUnits(foods);

    expect(await foods.getById(orphan.id)).toEqual(orphan);
  });

  it("never touches a custom food, even one sharing no id with the catalogue", async () => {
    const foods = repository();
    const custom: Food = {
      id: "custom",
      name: "Meu alimento",
      category: "protein",
      unit: "g",
      per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
      isCustom: true,
      isFavorite: false,
      createdAt: 1,
      updatedAt: 1,
    };
    await foods.save(custom, null);
    await seedCatalogue(foods);

    await refreshFoodPracticalUnits(foods);

    expect(await foods.getById("custom")).toEqual(custom);
  });
});
