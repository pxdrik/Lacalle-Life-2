"use client";

import { Play } from "lucide-react";
import Link from "next/link";

import { useSessionHistory } from "../hooks/use-session-history";
import { useTicker } from "../hooks/use-ticker";
import { formatDuration, sessionProgress } from "../services/session-stats";

/**
 * The workout left open.
 *
 * Without this a session started and abandoned is orphaned: the record sits in
 * storage, correct and complete, reachable only by its exact URL. Phones get
 * locked and tabs get closed mid-workout, so this is the normal case, not the
 * edge one.
 */
export function InProgressBanner() {
  const state = useSessionHistory();
  // Half a minute is precise enough for "started an hour ago", and reading the
  // clock during render would be impure.
  const now = useTicker(true, 30_000);

  if (state.status !== "ready" || state.inProgress === undefined) return null;

  const session = state.inProgress;
  const progress = sessionProgress(session);

  return (
    <Link
      href={`/sessao/${session.id}`}
      className="flex items-center gap-4 rounded-xl border border-accent bg-accent/5 p-4 transition-colors duration-150 ease-out hover:bg-accent/10"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink">
        <Play aria-hidden className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{session.name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Em andamento
          <span className="mx-1.5 text-line-strong">·</span>
          {progress.completed}/{progress.total} séries
          <span className="mx-1.5 text-line-strong">·</span>
          começou há {formatDuration(Math.max(0, now - session.startedAt))}
        </p>
      </div>

      <span className="shrink-0 text-sm font-medium text-ink">Continuar</span>
    </Link>
  );
}
