import { revise } from "@/core/domain/entity";

import type { Food, PracticalUnit } from "../types/food";
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

/**
 * Bumped whenever `catalogue.json` changes which entries carry a
 * `practicalUnit`.
 *
 * `seedCatalogue` only ever inserts ids missing from the store — see its own
 * comment — so a browser that already seeded, say, "Abacate" before this
 * field existed keeps the medialess (unit-less) copy forever unless
 * something goes back and patches it in. This is that something, modelled
 * directly on `refreshExerciseMedia` in the workouts feature, which solved
 * the identical problem for exercise photos.
 */
const PRACTICAL_UNIT_REVISION = 1;
const REVISION_KEY = "lacalle-life:food-practical-unit-revision";

/**
 * Brings stored catalogue foods up to the current set of practical units.
 *
 * Gated on a revision marker for the same reason as the exercise refresh:
 * the honest check is "read every row and compare", and paying that on every
 * cold start to usually find nothing changed is wasted work with no visible
 * benefit. Custom foods are skipped — the curated mapping has nothing to say
 * about a food the user typed in themselves.
 */
export async function refreshFoodPracticalUnits(
  repository: FoodRepository,
): Promise<void> {
  if (readRevision() >= PRACTICAL_UNIT_REVISION) return;

  const { default: entries } = await import("./catalogue.json");
  const typed = entries as readonly CatalogueEntry[];
  const unitById = new Map<string, PracticalUnit | undefined>(
    typed.map((entry) => [entry.id, entry.practicalUnit]),
  );

  const stale = (await repository.listAll()).filter(
    (food) =>
      !food.isCustom &&
      unitById.has(food.id) &&
      !sameUnit(food.practicalUnit, unitById.get(food.id)),
  );

  if (stale.length > 0) {
    await repository.saveMany(
      stale.map((food) =>
        revise(food, { practicalUnit: unitById.get(food.id) }),
      ),
    );
  }

  writeRevision();
}

function sameUnit(
  a: PracticalUnit | undefined,
  b: PracticalUnit | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.label === b.label && a.grams === b.grams;
}

function readRevision(): number {
  try {
    return Number(globalThis.localStorage?.getItem(REVISION_KEY) ?? 0);
  } catch {
    // Storage blocked. Returning 0 means we do the work every boot, which is
    // slow but correct — the alternative is silently never backfilling.
    return 0;
  }
}

function writeRevision(): void {
  try {
    globalThis.localStorage?.setItem(
      REVISION_KEY,
      String(PRACTICAL_UNIT_REVISION),
    );
  } catch {
    // Nothing to do: the refresh already succeeded, and without the marker
    // it simply runs again next time.
  }
}
