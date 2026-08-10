"use client";

import { useEffect, useState } from "react";

/**
 * How long the armed state waits before giving up on its own.
 *
 * Exported so the draining bar that shows the time left is driven by this
 * number rather than a copy of it. A progress indicator that disagrees with
 * the timer it reports on is worse than none.
 */
export const DISARM_AFTER_MS = 4000;

/**
 * "Are you sure?" asked by the control itself.
 *
 * Not a dialog: a modal for a yes/no steals focus, traps the keyboard and
 * needs an escape route, all to ask a question the button can ask in place.
 * The first tap arms it and changes what it says; the second does the thing.
 *
 * It disarms on its own after a few seconds, and callers wire `disarm` to
 * blur, so a button armed by a mis-tap cannot fire minutes later when someone
 * taps the same spot for a different reason.
 *
 * Extracted from `ConfirmButton` when finishing a workout early needed the
 * same two-tap guard on a control that looks nothing like it — the behaviour
 * is worth sharing, the small red icon button is not.
 */
export function useArmed(): {
  readonly armed: boolean;
  /** Runs `action` on the second call, arms on the first. */
  readonly confirm: (action: () => void) => void;
  readonly disarm: () => void;
} {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;

    const id = setTimeout(() => {
      setArmed(false);
    }, DISARM_AFTER_MS);

    return () => {
      clearTimeout(id);
    };
  }, [armed]);

  return {
    armed,
    confirm: (action) => {
      if (armed) {
        setArmed(false);
        action();
      } else {
        setArmed(true);
      }
    },
    disarm: () => {
      setArmed(false);
    },
  };
}
