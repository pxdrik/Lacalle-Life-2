import type { Food, FoodCategory } from "../types/food";

export interface FoodQuery {
  readonly text: string;
  readonly category: FoodCategory | null;
  readonly favoritesOnly: boolean;
}

/**
 * Accent-insensitive: someone typing "acucar" on a phone keyboard has to find
 * "Açúcar". Lowercasing alone would not do it.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Every term must appear, in any order, so "peito frango" finds
 * "Peito de frango grelhado" without the user having to guess the exact
 * phrasing the catalogue used.
 */
function matches(name: string, terms: readonly string[]): boolean {
  return terms.every((term) => name.includes(term));
}

/**
 * Lower is better. A name that begins with what was typed outranks one that
 * merely contains it, so "fra" puts "Frango desfiado" above
 * "Salada com frango".
 */
function rank(name: string, firstTerm: string): number {
  if (name.startsWith(firstTerm)) return 0;
  if (name.split(" ").some((word) => word.startsWith(firstTerm))) return 1;
  return 2;
}

/**
 * Filters and ranks in memory.
 *
 * The catalogue is a few hundred rows, so this runs in well under a
 * millisecond per keystroke — which is why there is no debounce, no query
 * cache and no loading state on search. Typing just filters.
 */
export function searchFoods(
  foods: readonly Food[],
  query: FoodQuery,
): readonly Food[] {
  const filtered = foods.filter(
    (food) =>
      (query.category === null || food.category === query.category) &&
      (!query.favoritesOnly || food.isFavorite),
  );

  const terms = normalize(query.text).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return filtered;

  const firstTerm = terms[0]!;

  return filtered
    .map((food) => ({ food, name: normalize(food.name) }))
    .filter(({ name }) => matches(name, terms))
    .map(({ food, name }) => ({ food, score: rank(name, firstTerm) }))
    // Sort is stable, so foods with equal score keep the alphabetical order
    // the repository already put them in.
    .sort((a, b) => a.score - b.score)
    .map(({ food }) => food);
}
