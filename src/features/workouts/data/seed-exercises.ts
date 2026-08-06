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

  const [{ CATALOGUE }, { default: aliases }] = await Promise.all([
    import("./catalogue/catalogue"),
    import("./aliases.json"),
  ]);

  const table = aliases as Record<string, string[] | undefined>;
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
    classification: "catalogue",
    isCustom: false,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  }));

  await repository.saveMany(exercises);
}
