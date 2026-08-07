"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";

import { useFoodLogRepository } from "../data/food-log-repository-context";
import { createFoodLog } from "../services/start-day";
import { isEmptyLog, type FoodLog } from "../types/food-log";

export type FoodLogState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly log: FoodLog }
  | { readonly status: "error"; readonly message: string };

export interface FoodLogDay {
  readonly state: FoodLogState;
  readonly saveError: string | null;
  /**
   * Applies a pure edit and persists the result.
   *
   * Same shape as the diet editor's `apply`, which is what lets both screens
   * drive the same meal operations and the same `MealCard`.
   */
  readonly apply: (change: (log: FoodLog) => FoodLog) => void;
  /** Replaces the whole day — used when starting it from a diet. */
  readonly replace: (log: FoodLog) => void;
  readonly clear: () => void;
}

/**
 * One day of the food log, loaded and written back.
 *
 * A day that ends up with no food in it is deleted rather than stored: an
 * empty Tuesday is not a Tuesday you logged, and keeping it would put a zero
 * on a chart where the truth is "no record".
 *
 * Writes optimistically — the edit is on screen before the write resolves,
 * because typing grams and waiting for IndexedDB would make every keystroke
 * feel like a network call. A failure surfaces in `saveError` with the value
 * still on screen.
 */
export function useFoodLogDay(day: string): FoodLogDay {
  const repository = useFoodLogRepository();
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * The loaded day travels with its own date.
   *
   * Deriving "loading" from a mismatch, rather than setting it in the effect
   * when `day` changes, keeps the effect free of a synchronous `setState` —
   * which the React Compiler rejects, and rightly: it costs a cascading render
   * and, here, would briefly show yesterday's food under today's heading.
   */
  const [loaded, setLoaded] = useState<{
    readonly day: string;
    readonly state: FoodLogState;
  } | null>(null);

  // Memoised so `apply` below keeps a stable identity between renders. The
  // alternative — reading the log inside a `setState` updater — is the impure
  // updater this codebase has been bitten by twice, and it stays out.
  const state: FoodLogState = useMemo(
    () =>
      loaded !== null && loaded.day === day
        ? loaded.state
        : { status: "loading" },
    [loaded, day],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const stored = await (await repository).getByDay(day);
        if (!active) return;

        setLoaded({
          day,
          state: { status: "ready", log: stored ?? createFoodLog(day) },
        });
      } catch (cause) {
        if (active) {
          setLoaded({
            day,
            state: { status: "error", message: describeDataError(cause) },
          });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository, day]);

  const setState = useCallback(
    (next: FoodLogState) => {
      setLoaded({ day, state: next });
    },
    [day],
  );

  const persist = useCallback(
    (log: FoodLog) => {
      setSaveError(null);

      void (async () => {
        try {
          const store = await repository;
          if (isEmptyLog(log)) await store.remove(log.id);
          else await store.save(log);
        } catch (cause) {
          setSaveError(describeDataError(cause));
        }
      })();
    },
    [repository],
  );

  const apply = useCallback(
    (change: (log: FoodLog) => FoodLog) => {
      if (state.status !== "ready") return;

      const next = change(state.log);
      // Same reference means the operation was a no-op — a stale click on a
      // meal already gone. Writing it would stamp `updatedAt` for nothing.
      if (next === state.log) return;

      setState({ status: "ready", log: next });
      persist(next);
    },
    [state, persist, setState],
  );

  const replace = useCallback(
    (log: FoodLog) => {
      setState({ status: "ready", log });
      persist(log);
    },
    [persist, setState],
  );

  const clear = useCallback(() => {
    replace(createFoodLog(day));
  }, [replace, day]);

  return { state, saveError, apply, replace, clear };
}
