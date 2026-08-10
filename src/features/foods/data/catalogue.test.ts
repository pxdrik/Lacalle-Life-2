import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { catalogueEntrySchema } from "../validation/food-schema";
import type { Food } from "../types/food";
import catalogue from "./catalogue.json";
import { seedCatalogue } from "./catalogue";
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
    const wild = catalogue.filter((food) => {
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

  it("does nothing when foods already exist", async () => {
    const foods = repository();
    await foods.save({
      id: "custom",
      name: "Meu alimento",
      category: "protein",
      per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
      isCustom: true,
      isFavorite: false,
      createdAt: 1,
      updatedAt: 1,
    });

    await seedCatalogue(foods);

    // A user's own food must never be buried under 216 catalogue rows.
    expect(await foods.listAll()).toHaveLength(1);
  });
});
