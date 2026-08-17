import { MUSCLE_LABELS } from "../taxonomy/muscles";
import type { Exercise } from "../types/exercise";

/**
 * Search over the exercise catalogue.
 *
 * Built around a prepared index rather than a bare array, and that is the
 * whole point of the shape: normalising 183 names on every keystroke is free,
 * but normalising 5.000 is not. The index does that work once, so what runs
 * per keystroke is plain `startsWith` and `includes` over strings that are
 * already lowercase and unaccented.
 *
 * When the catalogue outgrows a linear scan, `buildExerciseIndex` grows a trie
 * or an inverted index and `searchExercises` keeps its signature. Callers never
 * learn which one they are using — which is what "scales without changing the
 * public API" has to mean to be worth anything.
 */

export interface ExerciseIndex {
  readonly entries: readonly IndexedExercise[];
}

interface IndexedExercise {
  readonly exercise: Exercise;
  readonly name: string;
  readonly nameWords: readonly string[];
  readonly aliases: readonly string[];
  readonly aliasWords: readonly string[];
  /** Name and aliases joined — one `includes` answers "matches at all?". */
  readonly haystack: string;
  /**
   * Portuguese labels for `primaryMuscles` and `secondaryMuscles` — never
   * `stabilizerMuscles`, which trains isometrically rather than being what
   * "bíceps" or "peito" means to someone typing that word. Ranked below name
   * and alias in `rank()`: intent should never outrank someone who typed the
   * exercise's actual name.
   */
  readonly muscleWords: readonly string[];
  readonly muscleHaystack: string;
}

/**
 * Accent-insensitive: someone typing on a phone keyboard will not reach for
 * the ê in "Tríceps" or the ú in "Búlgaro".
 */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function buildExerciseIndex(
  exercises: readonly Exercise[],
): ExerciseIndex {
  const entries = exercises.map((exercise) => {
    const name = normalizeSearch(exercise.name);
    const aliases = exercise.aliases.map(normalizeSearch);

    const muscleLabels = [
      ...exercise.primaryMuscles,
      ...exercise.secondaryMuscles,
    ].map((muscle) => normalizeSearch(MUSCLE_LABELS[muscle]));

    return {
      exercise,
      name,
      nameWords: name.split(" "),
      aliases,
      aliasWords: aliases.flatMap((alias) => alias.split(" ")),
      haystack: [name, ...aliases].join(" | "),
      muscleWords: muscleLabels.flatMap((label) => label.split(" ")),
      muscleHaystack: muscleLabels.join(" | "),
    };
  });

  return { entries };
}

/**
 * Lower is better. A name that *starts* with what was typed outranks one that
 * merely contains it, and the exercise's own name outranks an alias — so
 * "rosca" leads with "Rosca 21", not with something whose nickname happens to
 * contain the word.
 */
const NO_MATCH = Number.POSITIVE_INFINITY;

function rank(entry: IndexedExercise, term: string): number {
  // Cheap gate first. Most entries do not match at all, and answering that
  // with two `includes` over prepared strings beats seven checks that each
  // allocate an iterator only to conclude the same thing.
  const matchesText = entry.haystack.includes(term);
  const matchesMuscle = entry.muscleHaystack.includes(term);
  if (!matchesText && !matchesMuscle) return NO_MATCH;

  if (matchesText) {
    if (entry.name.startsWith(term)) return 0;
    if (entry.aliases.some((alias) => alias.startsWith(term))) return 1;
    if (entry.nameWords.some((word) => word.startsWith(term))) return 2;
    if (entry.aliasWords.some((word) => word.startsWith(term))) return 3;
    if (entry.name.includes(term)) return 4;
    return 5;
  }

  // Only the muscle taxonomy matched — "bíceps" finds every biceps exercise,
  // but ranked below every text tier above: someone who typed a muscle is
  // browsing by intent, which should never outrank someone who typed the
  // exercise's actual name.
  if (entry.muscleWords.some((word) => word.startsWith(term))) return 6;
  return 7;
}

/**
 * Filters and ranks. Every term must match somewhere, in any order, so
 * "supino halter" finds "Supino Reto com Halteres" without the user having to
 * guess the catalogue's exact phrasing.
 *
 * Ordering is by the best rank the *first* term achieves: that is the word the
 * user led with, and therefore the one they are thinking in.
 */
export function searchExercises(
  index: ExerciseIndex,
  text: string,
): readonly Exercise[] {
  const terms = normalizeSearch(text).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return index.entries.map((entry) => entry.exercise);

  const matches: { score: number; exercise: Exercise }[] = [];

  for (const entry of index.entries) {
    let score = NO_MATCH;
    let matchesEvery = true;

    for (const [position, term] of terms.entries()) {
      const termScore = rank(entry, term);

      if (termScore === NO_MATCH) {
        matchesEvery = false;
        break;
      }
      if (position === 0) score = termScore;
    }

    if (matchesEvery) matches.push({ score, exercise: entry.exercise });
  }

  // Stable sort, so equally ranked results keep the alphabetical order the
  // repository already put them in.
  matches.sort((a, b) => a.score - b.score);

  return matches.map((match) => match.exercise);
}
