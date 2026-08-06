import { MUSCLE_REGION, type Region } from "../taxonomy/muscles";
import type { CatalogueEntry } from "../validation/exercise-schema";

/**
 * Integrity checks for the curated catalogue.
 *
 * Pure functions rather than assertions buried in a test file, for two
 * reasons: they can be run against deliberately broken input to prove they
 * actually detect something, and whoever adds a batch of exercises can run
 * them without reading the test.
 *
 * Every check returns the offending items, never a boolean — a failing build
 * that names the entry is a fix; one that says `false` is a hunt.
 */

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }

  return [...duplicates];
}

/**
 * Primary muscles are ordered by dominance, so the first one decides which
 * file an entry belongs in. Cardio is placed by pattern instead: running is
 * not a leg exercise in any useful sense.
 */
export function findMisplaced(
  entries: readonly CatalogueEntry[],
  region: Region,
): string[] {
  return entries
    .filter((entry) => entry.movementPattern !== "cardio")
    .filter((entry) => MUSCLE_REGION[entry.primaryMuscles[0]!] !== region)
    .map(
      (entry) =>
        `${entry.id}: pertence a ${MUSCLE_REGION[entry.primaryMuscles[0]!]}.json`,
    );
}

export function findStrayCardio(
  entries: readonly CatalogueEntry[],
  region: Region,
): string[] {
  if (region === "cardio") return [];

  return entries
    .filter((entry) => entry.movementPattern === "cardio")
    .map((entry) => `${entry.id}: cardio fora de cardio.json`);
}

export type AliasTable = Readonly<Record<string, readonly string[]>>;

export function findOrphanAliases(
  table: AliasTable,
  knownIds: ReadonlySet<string>,
): string[] {
  return Object.keys(table).filter((id) => !knownIds.has(id));
}

/**
 * An alias claimed by two exercises makes search return the wrong one with no
 * way for the user to tell why.
 */
export function findAmbiguousAliases(table: AliasTable): string[] {
  const owner = new Map<string, string>();
  const clashes: string[] = [];

  for (const [id, aliases] of Object.entries(table)) {
    for (const alias of aliases) {
      const key = normalizeName(alias);
      const existing = owner.get(key);

      if (existing !== undefined) clashes.push(`"${alias}": ${existing} e ${id}`);
      else owner.set(key, id);
    }
  }

  return clashes;
}

export function findRedundantAliases(
  table: AliasTable,
  namesById: ReadonlyMap<string, string>,
): string[] {
  return Object.entries(table).flatMap(([id, aliases]) =>
    aliases
      .filter((alias) => normalizeName(alias) === namesById.get(id))
      .map((alias) => `${id}: "${alias}" repete o próprio nome`),
  );
}

/**
 * Contradictions between fields that a reader would not notice but a filter
 * would act on.
 */
export function findIncoherent(entries: readonly CatalogueEntry[]): string[] {
  const problems: string[] = [];

  for (const entry of entries) {
    if (entry.isCompound === false && entry.primaryMuscles.length !== 1) {
      problems.push(`${entry.id}: isolado com mais de um músculo primário`);
    }

    if (entry.movementPattern === "isolation" && entry.isCompound === true) {
      problems.push(`${entry.id}: padrão isolation marcado como composto`);
    }

    const muscles = [
      ...entry.primaryMuscles,
      ...(entry.secondaryMuscles ?? []),
      ...(entry.stabilizerMuscles ?? []),
    ];
    if (new Set(muscles).size !== muscles.length) {
      problems.push(`${entry.id}: mesmo músculo listado em mais de um papel`);
    }
  }

  return problems;
}

/**
 * A saved workout references exercises by id. An id that vanishes takes
 * someone's history with it, so removing one has to be a deliberate edit to
 * `ids.lock.json` rather than a side effect of tidying a JSON file.
 */
export function findVanishedIds(
  publishedIds: readonly string[],
  presentIds: ReadonlySet<string>,
): string[] {
  return publishedIds.filter((id) => !presentIds.has(id));
}
