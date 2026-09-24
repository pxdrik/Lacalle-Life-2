"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DataError } from "@/core/domain/data-error";
import { describeDataError } from "@/core/domain/describe-data-error";
import { revise } from "@/core/domain/entity";
import { onStoreChanged } from "@/core/storage/store-events";

import { useWaterRepository } from "../data/water-repository-context";
import { createWaterEntry } from "../services/hydration-log";
import { isEmptyEntry, type WaterEntry } from "../types/water-entry";

export type WaterDayState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly entry: WaterEntry }
  | { readonly status: "error"; readonly message: string };

export interface WaterDay {
  readonly state: WaterDayState;
  readonly saveError: string | null;
  /** `true` specifically for `DataError("CONFLICT")` — see `reload`. */
  readonly hasConflict: boolean;
  /** Adds (or, with a negative value, corrects downward) to today's total. Never goes below 0. */
  readonly addMl: (deltaMl: number) => void;
  /** Re-reads this day from storage, replacing whatever is on screen — same escape hatch as `useFoodLogDay.reload`. */
  readonly reload: () => void;
}

/**
 * One day of the water log, loaded and written back.
 *
 * Same shape as `useFoodLogDay` — optimistic writes, version-checked saves,
 * `onStoreChanged` so a background sync pull or another tab is reflected
 * without a manual refresh — simplified because there is exactly one field
 * to hold and no "move to another day" affordance anywhere in the UI.
 */
export function useWaterDay(day: string): WaterDay {
  const repository = useWaterRepository();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  const [loaded, setLoaded] = useState<{
    readonly day: string;
    readonly state: WaterDayState;
  } | null>(null);

  /** The version this hook believes storage currently holds for `day`. */
  const expectedVersionRef = useRef<number | null>(null);
  const entryRef = useRef<WaterEntry | null>(null);

  const state: WaterDayState = useMemo(
    () =>
      loaded !== null && loaded.day === day
        ? loaded.state
        : { status: "loading" },
    [loaded, day],
  );

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const stored = await (await repository).getByDay(day);
        if (!active) return;

        expectedVersionRef.current = stored?.updatedAt ?? null;
        const entry = stored ?? createWaterEntry(day);
        entryRef.current = entry;
        setLoaded({ day, state: { status: "ready", entry } });
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
    const unsubscribe = onStoreChanged("waterEntries", () => {
      void load();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository, day, reloadToken]);

  const reload = useCallback(() => {
    setSaveError(null);
    setHasConflict(false);
    setLoaded({ day, state: { status: "loading" } });
    setReloadToken((token) => token + 1);
  }, [day]);

  const setState = useCallback(
    (next: WaterDayState) => {
      setLoaded({ day, state: next });
    },
    [day],
  );

  const persist = useCallback(
    (entry: WaterEntry, expectedUpdatedAt: number | null) => {
      setSaveError(null);
      setHasConflict(false);

      void (async () => {
        try {
          const store = await repository;
          if (isEmptyEntry(entry)) await store.remove(entry.id);
          else await store.save(entry, expectedUpdatedAt);
        } catch (cause) {
          setSaveError(describeDataError(cause));
          setHasConflict(
            cause instanceof DataError && cause.code === "CONFLICT",
          );
        }
      })();
    },
    [repository],
  );

  const addMl = useCallback(
    (deltaMl: number) => {
      const current = entryRef.current;
      if (current === null) return;

      const next = revise(current, {
        ml: Math.max(0, current.ml + deltaMl),
      });

      const expectedUpdatedAt = expectedVersionRef.current;
      entryRef.current = next;
      expectedVersionRef.current = isEmptyEntry(next) ? null : next.updatedAt;
      setState({ status: "ready", entry: next });
      persist(next, expectedUpdatedAt);
    },
    [persist, setState],
  );

  return { state, saveError, hasConflict, addMl, reload };
}
