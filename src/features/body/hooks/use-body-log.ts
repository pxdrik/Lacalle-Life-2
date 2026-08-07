"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import { revise } from "@/core/domain/entity";

import { useBodyRepository } from "../data/body-repository-context";
import { createBodyEntry } from "../services/body-log";
import { isEmptyEntry, type BodyEntry } from "../types/body-entry";

export type BodyLogState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly entries: readonly BodyEntry[] }
  | { readonly status: "error"; readonly message: string };

export interface BodyLog {
  readonly state: BodyLogState;
  readonly writeError: string | null;
  /**
   * Writes one day's record, replacing whatever that day already held.
   *
   * An entry that ends up recording nothing is removed instead of stored: a
   * day with no weight, no measurements and no note is not a day you logged,
   * it is a day you cleared.
   */
  readonly saveDay: (entry: BodyEntry) => Promise<boolean>;
  readonly removeDay: (day: string) => Promise<boolean>;
  /** The stored entry for a day, or a blank one ready to fill in. */
  readonly entryFor: (day: string) => BodyEntry;
}

/**
 * The whole body log, held in memory.
 *
 * All of it, deliberately: a daily weigh-in for five years is under two
 * thousand small records, and having them in memory is what lets the chart
 * switch range and metric without a round trip. The range index on the
 * repository exists for when that stops being true.
 */
export function useBodyLog(): BodyLog {
  const repository = useBodyRepository();
  const [entries, setEntries] = useState<readonly BodyEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const all = await (await repository).listAll();
        if (active) setEntries(all);
      } catch (cause) {
        if (active) setError(describeDataError(cause));
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  const removeEntry = useCallback(
    async (day: string): Promise<boolean> => {
      setWriteError(null);

      try {
        await (await repository).remove(day);
        setEntries((current) =>
          (current ?? []).filter((item) => item.day !== day),
        );
        return true;
      } catch (cause) {
        setWriteError(describeDataError(cause));
        return false;
      }
    },
    [repository],
  );

  // Declared after `removeEntry` because it calls it, which keeps the
  // dependency honest instead of silenced.
  const saveDay = useCallback(
    async (entry: BodyEntry): Promise<boolean> => {
      setWriteError(null);

      if (isEmptyEntry(entry)) return removeEntry(entry.day);

      const updated = revise(entry, {});

      try {
        await (await repository).save(updated);
        setEntries((current) => {
          const rest = (current ?? []).filter((item) => item.day !== updated.day);
          return [...rest, updated].sort((a, b) => a.day.localeCompare(b.day));
        });
        return true;
      } catch (cause) {
        setWriteError(describeDataError(cause));
        return false;
      }
    },
    [repository, removeEntry],
  );

  const entryFor = useCallback(
    (day: string): BodyEntry =>
      (entries ?? []).find((entry) => entry.day === day) ?? createBodyEntry(day),
    [entries],
  );

  const state: BodyLogState =
    error !== null
      ? { status: "error", message: error }
      : entries === null
        ? { status: "loading" }
        : { status: "ready", entries };

  return { state, writeError, saveDay, removeDay: removeEntry, entryFor };
}
