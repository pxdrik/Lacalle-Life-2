import { EQUIPMENT, type Equipment } from "../taxonomy/equipment";
import {
  MOVEMENT_PATTERNS,
  TECHNICAL_DIFFICULTIES,
  type MovementPattern,
  type TechnicalDifficulty,
} from "../taxonomy/movement";
import { MUSCLE_GROUPS, type MuscleGroup } from "../taxonomy/muscles";
import { EMPTY_FILTERS, type ExerciseFilters } from "./filter-exercises";

/**
 * Filters as URL search params, so a filtered view survives a refresh and can
 * be shared or bookmarked.
 *
 * Short keys because these end up visible in the address bar, and a URL that
 * reads `?m=chest,triceps&e=dumbbell` is one a person can edit by hand.
 *
 * Parsing is total: an unknown value is dropped rather than throwing. A URL is
 * user-editable input, and a typo in it must not blank the screen.
 */
export const FILTER_PARAMS = {
  text: "q",
  muscles: "m",
  equipment: "e",
  patterns: "p",
  difficulties: "d",
  favorites: "fav",
} as const;

function parseSet<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): Set<T> {
  if (raw === null || raw === "") return new Set();

  const valid = new Set<string>(allowed);
  return new Set(raw.split(",").filter((value): value is T => valid.has(value)));
}

export interface ExerciseQuery {
  readonly text: string;
  readonly filters: ExerciseFilters;
}

export function parseExerciseQuery(params: URLSearchParams): ExerciseQuery {
  return {
    text: params.get(FILTER_PARAMS.text) ?? "",
    filters: {
      muscles: parseSet<MuscleGroup>(params.get(FILTER_PARAMS.muscles), MUSCLE_GROUPS),
      equipment: parseSet<Equipment>(params.get(FILTER_PARAMS.equipment), EQUIPMENT),
      patterns: parseSet<MovementPattern>(
        params.get(FILTER_PARAMS.patterns),
        MOVEMENT_PATTERNS,
      ),
      difficulties: parseSet<TechnicalDifficulty>(
        params.get(FILTER_PARAMS.difficulties),
        TECHNICAL_DIFFICULTIES,
      ),
      favoritesOnly: params.get(FILTER_PARAMS.favorites) === "1",
    },
  };
}

/**
 * Only active dimensions appear. An unfiltered view has a clean URL rather
 * than a trail of empty parameters.
 *
 * Sets are serialised in taxonomy order, not insertion order, so the same
 * selection always produces the same URL — otherwise two identical views would
 * have different links depending on which chip was tapped first.
 */
/**
 * Generic rather than a loop over a tuple of dimensions: each dimension has
 * its own value type, and iterating them together collapses that to `never`.
 * One small function per call keeps each set matched to its own taxonomy.
 */
function writeSet<T extends string>(
  params: URLSearchParams,
  key: string,
  order: readonly T[],
  selected: ReadonlySet<T>,
): void {
  if (selected.size === 0) return;
  params.set(key, order.filter((value) => selected.has(value)).join(","));
}

export function serializeExerciseQuery(query: ExerciseQuery): string {
  const params = new URLSearchParams();
  const { text, filters } = query;

  if (text.trim() !== "") params.set(FILTER_PARAMS.text, text);

  writeSet(params, FILTER_PARAMS.muscles, MUSCLE_GROUPS, filters.muscles);
  writeSet(params, FILTER_PARAMS.equipment, EQUIPMENT, filters.equipment);
  writeSet(params, FILTER_PARAMS.patterns, MOVEMENT_PATTERNS, filters.patterns);
  writeSet(
    params,
    FILTER_PARAMS.difficulties,
    TECHNICAL_DIFFICULTIES,
    filters.difficulties,
  );

  if (filters.favoritesOnly) params.set(FILTER_PARAMS.favorites, "1");

  // `URLSearchParams` percent-encodes the separator, turning a readable
  // `m=chest,triceps` into `m=chest%2Ctriceps`. A comma is a legal sub-delimiter
  // in a query string, and the whole point of the short keys is a URL someone
  // can read and edit.
  return params.toString().replace(/%2C/g, ",");
}

export const EMPTY_QUERY: ExerciseQuery = { text: "", filters: EMPTY_FILTERS };
