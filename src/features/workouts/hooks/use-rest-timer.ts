"use client";

import { useCallback, useState } from "react";

import { useTicker } from "./use-ticker";

export interface RestTimer {
  /** Seconds left, or `null` when no rest is running. */
  readonly remainingSeconds: number | null;
  readonly totalSeconds: number | null;
  readonly isFinished: boolean;
  readonly start: (seconds: number) => void;
  readonly adjust: (seconds: number) => void;
  readonly stop: () => void;
}

/**
 * Rest between sets.
 *
 * Holds an end timestamp rather than a countdown, so the number is computed
 * from the clock every tick. A phone that sleeps for ninety seconds comes back
 * showing the correct remaining time instead of resuming where it stopped
 * counting.
 *
 * Deliberately not persisted. Losing a rest timer to a reload costs a glance
 * at the clock; persisting it would mean writing to storage every few seconds
 * for something that is over in two minutes.
 */
export function useRestTimer(): RestTimer {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);

  const now = useTicker(endsAt !== null, 250);

  const remainingSeconds =
    endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));

  return {
    remainingSeconds,
    totalSeconds,
    isFinished: remainingSeconds === 0,

    start: useCallback((seconds: number) => {
      setTotalSeconds(seconds);
      setEndsAt(Date.now() + seconds * 1000);
    }, []),

    /** Adds or removes time without restarting — the usual "+15s" mid-rest. */
    adjust: useCallback((seconds: number) => {
      setEndsAt((current) =>
        current === null
          ? current
          : Math.max(Date.now(), current + seconds * 1000),
      );
      setTotalSeconds((current) =>
        current === null ? current : Math.max(0, current + seconds),
      );
    }, []),

    stop: useCallback(() => {
      setEndsAt(null);
      setTotalSeconds(null);
    }, []),
  };
}
