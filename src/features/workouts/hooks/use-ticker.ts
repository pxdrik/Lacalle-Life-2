"use client";

import { useEffect, useState } from "react";

/**
 * A clock that re-renders on an interval while `active`.
 *
 * Returns the current timestamp rather than a counter, so everything derived
 * from it is computed from real time. A counter incremented per tick drifts
 * whenever the browser throttles a background tab — which is exactly what
 * happens when someone locks their phone between sets.
 */
export function useTicker(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    // No priming read before the interval: setting state synchronously in an
    // effect body causes a cascading render. The cost is that a ticker
    // activated well after mount reads up to one interval stale, which for a
    // clock displayed to the second nobody can see.
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(id);
    };
  }, [active, intervalMs]);

  return now;
}
