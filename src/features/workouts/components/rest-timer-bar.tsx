"use client";

import { X } from "lucide-react";

import { cn } from "@/design-system/cn";

import type { RestTimer } from "../hooks/use-rest-timer";
import { formatDuration } from "../services/session-stats";

/**
 * The rest countdown, pinned to the bottom of the screen.
 *
 * Bottom because that is where a thumb reaches, and because the top of the
 * screen is where the sets are. It covers nothing that matters: the set just
 * finished is above it, and the next one is scrolled into the middle.
 */
export function RestTimerBar({ timer }: { readonly timer: RestTimer }) {
  const { remainingSeconds, totalSeconds, isFinished } = timer;
  if (remainingSeconds === null || totalSeconds === null) return null;

  const progress = totalSeconds === 0 ? 1 : 1 - remainingSeconds / totalSeconds;

  return (
    <div
      role="status"
      aria-live="off"
      // Rises in: it appears the instant a set is marked done, and sliding up
      // from the edge says where it came from. Popping into place mid-workout
      // reads as a glitch.
      // Sits *above* the tab bar rather than on top of it: mid-workout both
      // matter, and a countdown covering the navigation would trap someone in
      // the session screen for the length of their rest.
      //
      // The safe-area padding applies only from `sm`, where there is no tab
      // bar beneath. Below that the offset already clears the inset, because
      // `--bottom-nav-h` contains it — padding it again here would count the
      // home indicator twice and leave a gap under the countdown.
      className={cn(
        "animate-rise fixed inset-x-0 bottom-(--bottom-nav-h) z-20",
        "border-t border-line bg-canvas",
        "sm:pb-[env(safe-area-inset-bottom)]",
        // Same `fixed` + `backdrop-filter` WebKit bug as `bottom-nav.tsx` —
        // see the comment there for why this is solid `bg-canvas` now,
        // not `bg-canvas/95 backdrop-blur`.
        "[transform:translateZ(0)]",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "h-0.5 origin-left transition-transform duration-200 ease-out",
          isFinished ? "bg-accent" : "bg-line-strong",
        )}
        style={{ transform: `scaleX(${String(progress)})` }}
      />

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] tracking-wide text-ink-subtle uppercase">
            {isFinished ? "Descanso concluído" : "Descanso"}
          </p>
          <p
            className={cn(
              "text-2xl tabular-nums",
              isFinished ? "text-accent-text" : "text-ink",
            )}
          >
            {formatDuration(remainingSeconds * 1000)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            timer.adjust(-15);
          }}
          className="h-11 rounded-md border border-line px-3 text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
        >
          −15s
        </button>
        <button
          type="button"
          onClick={() => {
            timer.adjust(15);
          }}
          className="h-11 rounded-md border border-line px-3 text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={timer.stop}
          aria-label="Encerrar descanso"
          className="flex size-11 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
