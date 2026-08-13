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
    <PageShell padding="tight">
      <PageHeader
        icon={ICONS.today}
        title="Hoje"
        subtitle={capitalise(formatLongDay(today))}
      />

      <HomeDataProvider>
        {/* The ring leads, alone, at the width of the page. It used to be one
            of four cards in a 2/3–1/3 grid, which is a layout that says "these
            four things are peers" — and they are not. Nothing sits beside it
            now, which is the entire point: a signature that shares a row is a
            widget. */}
        <div className="mx-auto max-w-2xl">
          <TodayEnergy day={today} />
        </div>

        {/* Grouped by space, not by border. `gap-10` between sections against
            `gap-4` inside one is what does the work a card outline used to do
            — the eye reads the larger gap as a boundary without a line being
            drawn. Two columns from `lg` because these three *are* peers. */}
        {/* `min-w-0` on the tracks, not decoration: a grid item defaults to
            `min-width: auto`, so it refuses to shrink below its own
            min-content. These sections used to be wrapped in a block inside
            the cell and were shielded from that; as direct children a long
            meal name pushed the track to 331px inside a 318px viewport and the
            whole page scrolled sideways. Caught at 320px. */}
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0">
            <TodayMeals day={today} />
          </div>
          {/* `space-y`, not a nested grid: the inner grid recreated the same
              `min-width: auto` one level down, and the resume banner — which
              only renders while a workout is running — pushed the page
              sideways again. Block flow shrinks without an exception. */}
          <div className="min-w-0 space-y-10">
            <TodayWorkout day={today} />
            <TodayProgress />
          </div>
        </div>
      </HomeDataProvider>
    </PageShell>
  );
}

/** `sexta-feira, 7 de agosto` → `Sexta-feira, 7 de agosto`. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
