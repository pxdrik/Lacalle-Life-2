"use client";

import { HomeDataProvider } from "@/composition/data-providers";
import { dayKey, formatLongDay } from "@/core/format/day";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { TodayProgress } from "@/features/body";
import { TodayEnergy } from "@/features/diet/components/today-energy";
import { TodayMeals } from "@/features/diet/components/today-meals";
import { TodayWorkout } from "@/features/workouts/components/today-workout";

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
 * **The four are not equally big, and the layout says so.** Food owns the left
 * two thirds — the calorie figure and then the meals behind it — while
 * training and weight stack down the right. Stacked full-width instead, they
 * read as four equal rows, which is both untrue and, on a 1440px screen, a
 * page you have to scroll to finish reading.
 *
 * `items-start` because these are independent answers: stretching a short card
 * to match a tall one would invent a relationship between them.
 *
 * A client route for the same reason as `/diario` — only the browser knows
 * what today is where the reader is standing.
 */
export default function HomePage() {
  const today = dayKey(new Date());

  return (
    <main className="mx-auto max-w-6xl px-6 py-6 sm:py-10">
      <PageHeader
        icon={ICONS.today}
        title="Hoje"
        subtitle={capitalise(formatLongDay(today))}
      />

      <div className="mt-6 grid gap-3 lg:grid-cols-3 lg:items-start">
        <HomeDataProvider>
          {/* `space-y-3` at every width, not `lg:` only: below `lg` these two
              are inside one grid cell, so the grid's own `gap-3` never lands
              between them and the cards met edge to edge on a phone. */}
          <div className="space-y-3 lg:col-span-2">
            <TodayEnergy day={today} />
            <TodayMeals day={today} />
          </div>
          {/* One cell holding two cards, not two cells in a two-row grid.
              As separate grid children their heights came from the rows the
              left column defined, so training ended 135px above weight while
              every other gap on the screen was 12 — a hole the layout never
              intended and that only appears once there is data in both. */}
          <div className="space-y-3">
            <TodayWorkout day={today} />
            <TodayProgress />
          </div>
        </HomeDataProvider>
      </div>
    </main>
  );
}

/** `sexta-feira, 7 de agosto` → `Sexta-feira, 7 de agosto`. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
