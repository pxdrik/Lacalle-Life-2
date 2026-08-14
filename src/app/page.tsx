"use client";

import { HomeDataProvider } from "@/composition/data-providers";
import { dayKey, formatLongDay } from "@/core/format/day";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { TodayProgress } from "@/features/body";
import { TodayEnergy } from "@/features/diet/components/today-energy";
import { TodayMeals } from "@/features/diet/components/today-meals";
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
 * **Rank comes from what a block holds, not from how it is drawn.** The five
 * cards share a radius, a padding and a border; the ring is the largest thing
 * on the screen and the only shape the app draws nowhere else, and that is
 * what makes it the signature. Dressing it differently from its neighbours
 * would rank it by decoration instead.
 *
 * `min-w-0` lives on each card rather than here: a grid item defaults to
 * `min-width: auto` and refuses to shrink below its own min-content, and a
 * long meal name once pushed the track to 331px inside a 318px viewport and
 * scrolled the whole page sideways. Caught at 320px, and still checked there.
 *
 * A client route for the same reason as `/diario` — only the browser knows
 * what today is where the reader is standing.
 */
export default function HomePage() {
  const today = dayKey(new Date());

  return (
    <PageShell padding="tight">
      <PageHeader
        icon={ICONS.today}
        title="Hoje"
        subtitle={capitalise(formatLongDay(today))}
      />

      <HomeDataProvider>
        {/* **One grid, and every answer is a block in it.**
            The screen used to group by space alone: a ring floating above two
            columns of borderless sections. It read as elements scattered on a
            page rather than as a screen with places in it, and the ring — the
            thing with no frame at all — was the loosest of them.

            So the blocks come back, and the ranking moves off geometry: every
            card is the same radius, the same padding and the same border, and
            what differs is what each one holds. `TodayEnergy` renders two of
            them, so the row reads as *how much is left* beside *what it is
            made of*.

            Order is the mobile order, and it is the priority order: calories,
            macros, meals, training, weight. No `order-*` anywhere — a grid
            that reads differently from the DOM reads differently to a screen
            reader too.

            Cards stretch to their row rather than sitting at its top. With
            meals and training side by side as peers, matching bottom edges is
            what makes them look like a pair instead of two things that happen
            to be adjacent. */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <TodayEnergy day={today} />
          <TodayMeals day={today} />
          <TodayWorkout day={today} />
          <TodayProgress />
        </div>
      </HomeDataProvider>
    </PageShell>
  );
}

/** `sexta-feira, 7 de agosto` → `Sexta-feira, 7 de agosto`. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
