"use client";

import Link from "next/link";

import { dayKey } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import { buttonClasses } from "@/design-system/components/button";
import { Section } from "@/design-system/components/section";
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
 *
 * **Two different registers for two different facts.** A session in progress
 * keeps the hero-adjacent treatment `InProgressBanner` already had — the one
 * thing on the screen that is happening *right now* earns it. Everything else
 * (finished today, or nothing yet) reads as `Section`, the same weight
 * `TodayMeals` uses for the other half of the day, so the two questions the
 * screen answers stay peers instead of one out-ranking the other by
 * accident.
 */
export function TodayWorkout({ day }: { readonly day: string }) {
  const state = useSessionHistory();

  if (state.status === "loading") {
    return <Skeleton className="h-40 w-full rounded-lg" />;
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

  const nothingYet = today.length === 0;

  return (
    <Section
      title="Treino"
      size="compact"
      className="min-w-0"
      action={
        !nothingYet ? (
          <Link
            href="/treinos"
            className="text-xs text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
          >
            Ver treinos
          </Link>
        ) : undefined
      }
    >
      {nothingYet ? (
        <Empty />
      ) : (
        <ul className="space-y-2">
          {today.map((session) => (
            <li key={session.id}>
              <FinishedSession session={session} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * The same shape as the meals block's empty state, and that is the point.
 *
 * These two answer the two halves of a day and sit side by side, so a
 * sentence here against an icon-and-button there made training read as the
 * lesser of the pair — a difference in treatment that says nothing true.
 * `Começar` is the same link to the same route it has always been; it moved
 * out of the header and put on the button the other block already wore.
 */
function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <ICONS.workouts aria-hidden className="size-8 text-ink-subtle" />
      <p className="text-sm text-ink-muted">Nada registrado hoje.</p>
      <Link href="/treinos" className={buttonClasses("secondary", "sm")}>
        Começar
      </Link>
    </div>
  );
}

function FinishedSession({ session }: { readonly session: Session }) {
  const duration = sessionDurationMs(session);
  const volume = sessionVolumeKg(session);

  return (
    <Link
      href={`/sessao/${session.id}`}
      className="flex items-baseline gap-3 rounded-sm px-2 py-1.5 -mx-2 transition-colors duration-150 ease-out hover:bg-muted"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {session.name}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-ink-muted">
        {duration === null ? "—" : formatDuration(duration)}
        <span className="mx-1.5 text-line-strong">·</span>
        {formatDecimal(volume.kg)} kg
      </span>
    </Link>
  );
}
