import type { Food } from "../types/food";
import type { CatalogueEntry } from "../validation/food-schema";
import type { FoodRepository } from "./food-repository";

/**
 * Puts the bundled catalogue into local storage on first run.
 *
 * The JSON is loaded with a dynamic import so that ~20 KB of food data stays
 * out of the main bundle: after the first visit it is in IndexedDB and the
 * file is never fetched again.
 *
 * Seeding is skipped once anything is stored. That means a future catalogue
 * update needs a version marker to reach existing installs — a contained
 * change to this function, and not worth building before there is a second
 * version of the catalogue to ship.
 */
export async function seedCatalogue(repository: FoodRepository): Promise<void> {
  if (!(await repository.isEmpty())) return;

  const { default: entries } = await import("./catalogue.json");
  const now = Date.now();

  // Shape is guaranteed by `catalogue.test.ts`, which validates this exact
  // file against the schema at build time — so it is not re-validated here on
  // every first run.
  const foods: Food[] = (entries as readonly CatalogueEntry[]).map((entry) => ({
    ...entry,
    createdAt: now,
    updatedAt: now,
    isCustom: false,
  }));

  await repository.saveMany(foods);
}
