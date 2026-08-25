"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DataError } from "@/core/domain/data-error";
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
  /** `true` specifically for `DataError("CONFLICT")` — see `reload`. */
  readonly hasConflict: boolean;
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
  /**
   * Re-reads this day from storage, replacing whatever is on screen.
   *
   * Once a save is rejected as a conflict, `expectedVersionRef` is
   * permanently stale until something re-reads the day — otherwise every
   * `apply` after the first one fails the same way, silently, because it
   * keeps sending the same version storage already moved past. This is that
   * re-read, offered as an explicit action rather than happening on the
   * person's behalf.
   */
  readonly reload: () => void;
}

/**
 * One day of the food log, loaded and written back.
 *
 * A day that ends up with nothing in it is deleted rather than stored: an
 * untouched Tuesday is not a Tuesday you logged, and keeping it would put a
 * zero on a chart where the truth is "no record".
 *
 * **Nothing means no meals**, not "no food". See `isEmptyLog`: a day holding a
 * meal somebody named and has not filled yet is a day in progress, and this
 * used to throw it away on the way to storage.
 *
 * Writes optimistically — the edit is on screen before the write resolves,
 * because typing grams and waiting for IndexedDB would make every keystroke
 * feel like a network call. A failure surfaces in `saveError` with the value
 * still on screen.
 */
export function useFoodLogDay(day: string): FoodLogDay {
  const repository = useFoodLogRepository();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

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

  /**
   * The version this hook believes storage currently holds for `day` — `null`
   * meaning no record exists yet. Tracked separately from the log itself
   * because the log always has *some* `updatedAt` (the blank fallback's own
   * synthetic one when nothing is stored), and that value must never be
   * mistaken for a version storage actually has.
   */
  const expectedVersionRef = useRef<number | null>(null);

  /**
   * Mirrors `state.log`, kept current everywhere the log changes — the load
   * effect below and `apply`/`replace` further down — rather than derived
   * during render. Refs cannot be written during render (React may render
   * without committing), and `apply` needs the most recent log even when
   * several calls land before React re-renders — elsewhere that is solved
   * with `setState`'s functional form, but this hook's own history already
   * ruled out a side effect inside a `setState` updater (see the file
   * comment).
   */
  const logRef = useRef<FoodLog | null>(null);

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

  /**
   * Bumped by `reload` to re-run the effect below. Kept as a token the effect
   * depends on, rather than an extracted `load` function called from inside
   * it: the latter is exactly the shape `react-hooks/set-state-in-effect`
   * flags, even though the write only ever happens after the `await`.
   */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const stored = await (await repository).getByDay(day);
        if (!active) return;

        // `stored` absent means this day has no record at all — the version
        // to expect on the next write is `null` (a create), not the blank
        // fallback log's own synthetic `updatedAt`. Losing that distinction
        // is exactly what made the first save of a fresh day look like a
        // conflict against nothing.
        expectedVersionRef.current = stored?.updatedAt ?? null;
        const log = stored ?? createFoodLog(day);
        logRef.current = log;
        setLoaded({ day, state: { status: "ready", log } });
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
  }, [repository, day, reloadToken]);

  const reload = useCallback(() => {
    setSaveError(null);
    setHasConflict(false);
    setLoaded({ day, state: { status: "loading" } });
    setReloadToken((token) => token + 1);
  }, [day]);

  const setState = useCallback(
    (next: FoodLogState) => {
      setLoaded({ day, state: next });
    },
    [day],
  );

  const persist = useCallback(
    (log: FoodLog, expectedUpdatedAt: number | null) => {
      setSaveError(null);
      setHasConflict(false);

      void (async () => {
        try {
          const store = await repository;
          if (isEmptyLog(log)) await store.remove(log.id);
          else await store.save(log, expectedUpdatedAt);
        } catch (cause) {
          setSaveError(describeDataError(cause));
          setHasConflict(cause instanceof DataError && cause.code === "CONFLICT");
        }
      })();
    },
    [repository],
  );

  const apply = useCallback(
    (change: (log: FoodLog) => FoodLog) => {
      const current = logRef.current;
      if (current === null) return;

      const next = change(current);
      // Same reference means the operation was a no-op — a stale click on a
      // meal already gone. Writing it would stamp `updatedAt` for nothing.
      if (next === current) return;

      const expectedUpdatedAt = expectedVersionRef.current;
      logRef.current = next;
      // Optimistic, matching the log itself: if the write is rejected, both
      // this and the on-screen value are equally stale until the banner
      // prompts a reload — the same trade-off this hook already makes for
      // the log, not a new one. An empty log takes the `remove` branch in
      // `persist` below, so the version it leaves storage in is "absent",
      // not `next.updatedAt`.
      expectedVersionRef.current = isEmptyLog(next) ? null : next.updatedAt;
      setState({ status: "ready", log: next });
      persist(next, expectedUpdatedAt);
    },
    [persist, setState],
  );

  const replace = useCallback(
    (log: FoodLog) => {
      const expectedUpdatedAt = expectedVersionRef.current;
      logRef.current = log;
      expectedVersionRef.current = isEmptyLog(log) ? null : log.updatedAt;
      setState({ status: "ready", log });
      persist(log, expectedUpdatedAt);
    },
    [persist, setState],
  );

  const clear = useCallback(() => {
    replace(createFoodLog(day));
  }, [replace, day]);

  return { state, saveError, hasConflict, apply, replace, clear, reload };
}
