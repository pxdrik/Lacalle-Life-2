"use client";

import { useEffect, useState } from "react";

import { dayKey } from "@/core/format/day";

import { useBodyRepository } from "../data/body-repository-context";

/** How far back "recently" reaches. */
export const PROGRESS_WINDOW_DAYS = 30;

export interface WeightProgress {
  /** The most recent weigh-in. */
  readonly latestKg: number;
  readonly latestDay: string;

  /**
   * Change against the oldest weigh-in inside the window, in kilograms.
   *
   * `null` when there is nothing to compare against — a single weigh-in, or a
   * window holding only today's. A delta of exactly zero is a real answer and
   * is reported as `0`, never as `null`.
   */
  readonly changeKg: number | null;

  /** The day `changeKg` is measured from. `null` whenever `changeKg` is. */
  readonly sinceDay: string | null;
}

/**
 * Weight, and whether it is going anywhere.
 *
 * Separate from `useLatestWeighIn`, which answers "is the profile's weight
 * stale" and needs exactly one number. This answers "am I getting anywhere",
 * which is a different question and cannot be served by the same shape — a
 * card that shows `82,4 kg` and nothing else is a reading, not progress.
 *
 * The comparison runs against the **oldest** weigh-in in the window rather
 * than the previous one. Weight swings a kilo between two mornings for reasons
 * that have nothing to do with a diet, so "since yesterday" mostly reports
 * water. Thirty days back is far enough that the number means something.
 *
 * `null` while loading and whenever nothing was ever weighed, exactly like its
 * sibling: the screen this feeds works without it.
 */
export function useWeightProgress(): WeightProgress | null {
  const repository = useBodyRepository();
  const [progress, setProgress] = useState<WeightProgress | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const entries = await (await repository).listAll();
        if (!active) return;

        // Sorted here rather than trusted, for the same reason its sibling
        // sorts: the day is plain text that orders chronologically, so proving
        // it costs one comparison and removes a dependency on someone else's
        // ordering staying true.
        const weighed = entries
          .filter((entry) => entry.weightKg !== null)
          .sort((a, b) => a.day.localeCompare(b.day));

        const latest = weighed.at(-1);
        if (latest?.weightKg == null) {
          setProgress(null);
          return;
        }

        const opened = new Date();
        opened.setDate(opened.getDate() - PROGRESS_WINDOW_DAYS);
        const from = dayKey(opened);

        // Everything in the window except the latest itself, oldest first.
        const earlier = weighed.filter(
          (entry) => entry.day >= from && entry.day !== latest.day,
        );
        const reference = earlier.at(0);

        setProgress({
          latestKg: latest.weightKg,
          latestDay: latest.day,
          changeKg:
            reference?.weightKg == null
              ? null
              : latest.weightKg - reference.weightKg,
          sinceDay: reference?.weightKg == null ? null : reference.day,
        });
      } catch {
        // The screen works without this. A body log that cannot be read is not
        // a reason to break the page around it.
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  return progress;
}
