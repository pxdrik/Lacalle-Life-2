"use client";

import Link from "next/link";

import { dayKey } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";
import { ICONS } from "@/design-system/icons";

import { useSessionHistory } from "../hooks/use-session-history";
import {
  formatDuration,
  sessionDurationMs,
  sessionVolumeKg,
} from "../services/session-stats";
import type { Session } from "../types/session";
import { InProgressBanner } from "./in-progress-banner";

/**
 * Whether today's training happened, and what it was.
 *
 * The other half of the question the home screen answers. It owns the whole
 * workout slot rather than sitting beside the "resume" banner: showing
 * "nenhum treino hoje" underneath a workout that is running right now would be
 * the screen contradicting itself.
 */
export function TodayWorkout({ day }: { readonly day: string }) {
  const state = useSessionHistory();

  if (state.status === "loading") {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  // Silent on failure. The workout half of the day is worth showing when it
  // can be read and not worth an alarm when it cannot — the diary above it is
  // still useful, and `/treinos` will report the same error properly.
  if (state.status === "error") return null;

  if (state.inProgress !== undefined) return <InProgressBanner />;

  const today = state.sessions.filter(
    (session) =>
      session.finishedAt !== null &&
      dayKey(new Date(session.startedAt)) === day,
  );

  return (
    <Card as="section">
      <div className="flex items-center justify-between gap-4">
        {/* The one card of the four on this screen that had no glyph, next to
            three that did — which reads as an oversight rather than as
            restraint. Same dumbbell as `/treinos`, from the same table. */}
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <ICONS.workouts aria-hidden className="size-4 text-ink-subtle" />
          Treino
        </h2>
        <Link
          href="/treinos"
          className="text-sm text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
        >
          {today.length === 0 ? "Começar" : "Ver treinos"}
        </Link>
      </div>

      {today.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Nada registrado hoje.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {today.map((session) => (
            <li key={session.id}>
              <FinishedSession session={session} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FinishedSession({ session }: { readonly session: Session }) {
  const duration = sessionDurationMs(session);
  const volume = sessionVolumeKg(session);

  return (
    <Link
      href={`/sessao/${session.id}`}
      className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-150 ease-out hover:bg-muted"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {session.name}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-ink-muted">
        {duration === null ? "—" : formatDuration(duration)}
        <span className="mx-1.5 text-line-strong">·</span>
        {formatDecimal(volume)} kg
      </span>
    </Link>
  );
}
