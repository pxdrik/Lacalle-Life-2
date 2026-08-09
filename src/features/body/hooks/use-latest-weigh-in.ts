"use client";

import { useEffect, useState } from "react";

import { useBodyRepository } from "../data/body-repository-context";

export interface WeighIn {
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly day: string;
  readonly weightKg: number;
}

/**
 * The most recent day somebody actually stepped on a scale.
 *
 * Narrow on purpose. The profile needs one number to notice it has gone stale,
 * and giving it `useBodyLog` would hand a screen that only reads the whole
 * editing API — save, remove, move a record to another day. A feature's public
 * surface should be what its consumers need, not everything it happens to own.
 *
 * `null` while loading, when nothing was ever recorded, and when the log holds
 * only entries without a weight — measurements and notes count as a record of
 * the day, but not as a weigh-in.
 */
export function useLatestWeighIn(): WeighIn | null {
  const repository = useBodyRepository();
  const [latest, setLatest] = useState<WeighIn | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const entries = await (await repository).listAll();
        if (!active) return;

        // Sorted here rather than trusted: `listAll` documents oldest-first,
        // and the day is plain text that sorts chronologically, so proving it
        // costs one comparison and removes a dependency on someone else's
        // ordering staying true.
        const weighed = entries
          .filter((entry) => entry.weightKg !== null)
          .sort((a, b) => a.day.localeCompare(b.day));

        const last = weighed.at(-1);
        setLatest(
          last === undefined || last.weightKg === null
            ? null
            : { day: last.day, weightKg: last.weightKg },
        );
      } catch {
        // The profile works without this; a body log that cannot be read is
        // not a reason to break the screen that shows someone's targets.
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  return latest;
}
