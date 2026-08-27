"use client";

import { useSyncExternalStore } from "react";

import { HomeDataProvider } from "@/composition/data-providers";
import { dayKey, formatLongDay } from "@/core/format/day";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { TodayProgress } from "@/features/body";
import { TodayEnergy } from "@/features/diet/components/today-energy";
import { TodayMeals } from "@/features/diet/components/today-meals";
import { ProfileIncompleteNotice } from "@/features/profile/components/profile-incomplete-notice";
import { TodayWorkout } from "@/features/workouts/components/today-workout";
import { PageShell } from "@/design-system/components/page-shell";

/**
 * How today is going.
 *
 * This page was a slogan until now, and the comment where the slogan lived
 * said why: a dashboard appears when there is data to summarise, and
 * scaffolding one before that is decoration. The condition has since been met
 * — there are diets, a diary, sessions, weigh-ins and targets — and the gap it
 * left was the one thing a comparison against V1 found that this app did not
 * have and should.
 *
 * It answers four questions and stops: how much of the day is left to eat,
 * what has been eaten, whether training happened, and whether the weight is
 * going anywhere. It deliberately carries no quick-action row: the navigation
 * is three centimetres above it, and a second copy of the menu dressed as
 * buttons is not a feature.
 *
 * **Sprint 8 — four ranks, not five equal cards.** The screen used to be five
 * bordered boxes of identical weight; the auditory finding behind this sprint
 * named it directly: nothing on the page read as *the* answer, everything
 * argued for the same amount of attention. The new order is the mobile order
 * and it is now also the visual order:
 *
 * 1. **Hero** — `TodayEnergy`, the calorie ring with macros folded into the
 *    same card as a secondary metric strip, not a sibling card of equal rank.
 * 2. **Alimentação** — `TodayMeals`, a borderless `Section`.
 * 3. **Treino** — `TodayWorkout`, the same `Section` weight as Alimentação,
 *    except when a session is genuinely running right now, which keeps the
 *    hero-adjacent treatment `InProgressBanner` already had.
 * 4. **Apoio** — `TodayProgress`, a single row with no surface at all, the
 *    quietest thing on the page.
 *
 * `min-w-0` lives on each block rather than here: a grid item defaults to
 * `min-width: auto` and refuses to shrink below its own min-content, and a
 * long meal name once pushed the track to 331px inside a 318px viewport and
 * scrolled the whole page sideways. Caught at 320px, and still checked there.
 *
 * A client route for the same reason as `/diario` — only the browser knows
 * what today is where the reader is standing.
 *
 * **`today` reads through `useSyncExternalStore`, the same mechanism
 * `ThemeProvider` already uses for "the server cannot know this value".**
 * `dayKey(new Date())` read straight into render used to run once on the
 * server (its own clock, usually UTC) and again on the client (the reader's
 * local clock) — two different day keys, so the subtitle text and every
 * child fetching by `day` disagreed with what the server had sent, and React
 * refused to hydrate (external audit, 27/08/2026: error #418 on every load).
 * `getServerToday` hands back `null` for both the server render and the
 * first client render, so hydration always matches; React then re-renders
 * once, immediately, with `getToday`'s real answer — no effect, no manual
 * `setState`, and nothing for `react-hooks/set-state-in-effect` to flag,
 * because there is no effect calling `setState` at all.
 */
function getToday(): string | null {
  return dayKey(new Date());
}

function getServerToday(): string | null {
  return null;
}

function subscribeToNothing() {
  // The day this page opened to never changes again on its own — nothing to
  // subscribe to. `useSyncExternalStore` still needs a function here to do
  // the one resync after hydration described above.
  return () => {};
}

export default function HomePage() {
  const today = useSyncExternalStore(subscribeToNothing, getToday, getServerToday);

  return (
    <PageShell padding="tight">
      <PageHeader
        icon={ICONS.today}
        title="Hoje"
        subtitle={today === null ? undefined : capitalise(formatLongDay(today))}
      />

      {today === null ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : (
        <HomeDataProvider>
          <ProfileIncompleteNotice />

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <TodayEnergy day={today} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <TodayMeals day={today} />
            <TodayWorkout day={today} />
          </div>

          <div className="mt-6 border-t border-line pt-3">
            <TodayProgress />
          </div>
        </HomeDataProvider>
      )}
    </PageShell>
  );
}

/** `sexta-feira, 7 de agosto` → `Sexta-feira, 7 de agosto`. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
