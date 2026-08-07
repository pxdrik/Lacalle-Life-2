import { revise } from "@/core/domain/entity";

import type { ExerciseMedia } from "../taxonomy/media-sources";
import type { Exercise } from "../types/exercise";
import type { CatalogueEntry } from "../validation/exercise-schema";
import type { ExerciseRepository } from "./exercise-repository";

/**
 * Puts the curated catalogue into local storage on first run.
 *
 * Loaded with a dynamic import so the catalogue stays out of the main bundle:
 * after the first visit it lives in IndexedDB and the files are never fetched
 * again.
 *
 * Aliases are merged in here rather than stored in a second table. They are
 * kept in their own file because they are edited on a different cadence, but
 * at runtime an exercise and the names people call it by are one thing.
 *
 * Seeding is skipped once anything is stored, so a user's own exercises are
 * never buried under a re-seed.
 */
export async function seedExerciseCatalogue(
  repository: ExerciseRepository,
): Promise<void> {
  if (!(await repository.isEmpty())) return;

  const [{ CATALOGUE }, { default: aliases }, { default: media }] =
    await Promise.all([
      import("./catalogue/catalogue"),
      import("./aliases.json"),
      import("./exercise-media.json"),
    ]);

  const table = aliases as Record<string, string[] | undefined>;
  const pictures = media as Record<string, ExerciseMedia | undefined>;
  const now = Date.now();

  const exercises: Exercise[] = CATALOGUE.map((entry: CatalogueEntry) => ({
    id: entry.id,
    name: entry.name,
    aliases: table[entry.id] ?? [],
    primaryMuscles: entry.primaryMuscles,
    secondaryMuscles: entry.secondaryMuscles ?? [],
    stabilizerMuscles: entry.stabilizerMuscles ?? [],
    equipment: entry.equipment,
    movementPattern: entry.movementPattern ?? null,
    movementPlanes: entry.movementPlanes ?? [],
    technicalDifficulty: entry.technicalDifficulty ?? null,
    isUnilateral: entry.isUnilateral ?? null,
    isCompound: entry.isCompound ?? null,
    media: pictures[entry.id] ?? null,
    classification: "catalogue",
    isCustom: false,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  }));

  await repository.saveMany(exercises);
}

/**
 * Bumped whenever `exercise-media.json` changes.
 *
 * Without it, photos would only ever reach people installing the app for
 * the first time: seeding skips itself once anything is stored, so everyone
 * already using it would keep the medialess copy they seeded months ago.
 */
const MEDIA_REVISION = 2;
const REVISION_KEY = "lacalle-life:exercise-media-revision";

/**
 * Brings stored catalogue rows up to the current set of photos.
 *
 * Gated on a revision marker rather than run every boot, because the honest
 * version of this check is "read all 183 rows and compare", and paying that on
 * every cold start to discover nothing changed is the kind of cost that never
 * shows up in a profile but is always there.
 *
 * The marker lives in `localStorage`, which can be cleared independently of
 * IndexedDB. That is fine: the worst case is doing this work twice, and the
 * work is idempotent.
 *
 * User-created exercises are skipped — they own their own media, and the
 * curated mapping has nothing to say about them.
 */
export async function refreshExerciseMedia(
  repository: ExerciseRepository,
): Promise<void> {
  if (readRevision() >= MEDIA_REVISION) return;

  const { default: media } = await import("./exercise-media.json");
  const pictures = media as Record<string, ExerciseMedia | undefined>;

  const stale = (await repository.listAll()).filter(
    (exercise) =>
      !exercise.isCustom &&
      !sameMedia(exercise.media, pictures[exercise.id] ?? null),
  );

  if (stale.length > 0) {
    await repository.saveMany(
      stale.map((exercise) =>
        revise(exercise, { media: pictures[exercise.id] ?? null }),
      ),
    );
  }

  writeRevision();
}

/**
 * `undefined` and `null` are different answers here, and the difference is the
 * whole point of this function.
 *
 * Rows written before photos existed have no `media` key at all. The
 * type says `ExerciseMedia | null` because that is what we *write*; what we
 * *read* is whatever an older version of this app stored, and no type can make
 * that claim true retroactively. Treating a missing key as "already decided
 * there is no image" would skip exactly the rows this refresh exists to fix.
 */
function sameMedia(
  stored: ExerciseMedia | null | undefined,
  desired: ExerciseMedia | null,
): boolean {
  if (stored === undefined) return false;
  if (stored === null || desired === null) return stored === desired;

  return (
    stored.source === desired.source &&
    stored.images.length === desired.images.length &&
    stored.images.every((path, index) => path === desired.images[index])
  );
}

function readRevision(): number {
  try {
    return Number(globalThis.localStorage?.getItem(REVISION_KEY) ?? 0);
  } catch {
    // Storage blocked. Returning 0 means we do the work every boot, which is
    // slow but correct — the alternative is silently shipping no images.
    return 0;
  }
}

function writeRevision(): void {
  try {
    globalThis.localStorage?.setItem(REVISION_KEY, String(MEDIA_REVISION));
  } catch {
    // Nothing to do: the refresh already succeeded, and without the marker it
    // simply runs again next time.
  }
}
