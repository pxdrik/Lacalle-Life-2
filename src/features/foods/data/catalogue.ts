import type { Food } from "../types/food";
import type { CatalogueEntry } from "../validation/food-schema";
import type { FoodRepository } from "./food-repository";

/**
 * Puts the bundled catalogue into local storage — first run, and again
 * whenever a later release adds entries an already-seeded browser does not
 * have yet.
 *
 * The JSON is loaded with a dynamic import so that the catalogue's data
 * stays out of the main bundle: it is fetched once per session, not on
 * every render.
 *
 * **This used to skip itself once anything was stored**, which was correct
 * the day it was written and stopped being correct the day a second version
 * of the catalogue existed to ship — the comment that used to live here said
 * so directly: "not worth building before there is a second version of the
 * catalogue to ship." There is now one: the 216 originally curated foods
 * plus 365 more brought in from the TACO table. An `isEmpty()`-only guard
 * would leave every browser that already opened the app once permanently
 * on 216, since re-seeding was never retried.
 *
 * The fix reads by id rather than tracking a version number: `listAll()`
 * once, diff against the bundled catalogue, insert only what is missing.
 * It is naturally idempotent (an up-to-date store has nothing missing, so
 * this is a no-op) and it can never touch an id that already exists — a
 * user's favourite on an old catalogue entry, or a custom food with an
 * unrelated id, is never overwritten. The cost is one `listAll()` per app
 * session rather than per first run, which is cheap against a few hundred
 * rows read once from a connection the rest of startup already opens.
 */
export async function seedCatalogue(repository: FoodRepository): Promise<void> {
  const { default: entries } = await import("./catalogue.json");
  // Shape is guaranteed by `catalogue.test.ts`, which validates this exact
  // file against the schema at build time — so it is not re-validated here.
  const typed = entries as readonly CatalogueEntry[];

  const existingIds = new Set((await repository.listAll()).map((food) => food.id));
  const missing = typed.filter((entry) => !existingIds.has(entry.id));
  if (missing.length === 0) return;

  const now = Date.now();
  const foods: Food[] = missing.map((entry) => ({
    ...entry,
    createdAt: now,
    updatedAt: now,
    isCustom: false,
    isFavorite: false,
  }));

  await repository.saveMany(foods);
}
