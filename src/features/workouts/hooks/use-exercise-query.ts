"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import {
  countActiveFilters,
  type ExerciseFilters,
} from "../services/filter-exercises";
import {
  EMPTY_QUERY,
  parseExerciseQuery,
  serializeExerciseQuery,
  type ExerciseQuery,
} from "../services/filter-url";

export interface ExerciseQueryState {
  readonly query: ExerciseQuery;
  readonly activeFilterCount: number;
  readonly setText: (text: string) => void;
  readonly setFilters: (filters: ExerciseFilters) => void;
  readonly clear: () => void;
}

/**
 * The search text and filters, mirrored into the URL.
 *
 * State lives in React and the URL is written from it, not the other way
 * round. Driving the input from `useSearchParams` would put a router
 * navigation between the keystroke and the character appearing — which is
 * exactly the lag the "no artificial debounce" requirement is about.
 *
 * The URL is updated with `history.replaceState`: no navigation, no history
 * entry per letter typed, and a refresh still restores the view.
 */
export function useExerciseQuery(persist = true): ExerciseQueryState {
  const searchParams = useSearchParams();

  // Read once, on mount. Afterwards this hook owns the value; the URL is an
  // output. Reading it continuously would fight the user's typing.
  const [query, setQuery] = useState<ExerciseQuery>(() =>
    persist
      ? parseExerciseQuery(new URLSearchParams(searchParams.toString()))
      : EMPTY_QUERY,
  );

  const apply = useCallback(
    (next: ExerciseQuery) => {
      setQuery(next);
      if (!persist) return;

      const search = serializeExerciseQuery(next);
      window.history.replaceState(
        null,
        "",
        search === "" ? window.location.pathname : `?${search}`,
      );
    },
    [persist],
  );

  return {
    query,
    activeFilterCount: countActiveFilters(query.filters),

    setText: useCallback(
      (text: string) => {
        apply({ ...query, text });
      },
      [apply, query],
    ),

    setFilters: useCallback(
      (filters: ExerciseFilters) => {
        apply({ ...query, filters });
      },
      [apply, query],
    ),

    clear: useCallback(() => {
      apply(EMPTY_QUERY);
    }, [apply]),
  };
}
