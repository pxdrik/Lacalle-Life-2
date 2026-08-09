"use client";

import { HomeDataProvider } from "@/composition/data-providers";
import { dayKey, formatLongDay } from "@/core/format/day";
import { PageHeader } from "@/design-system/components/page-header";
import { TodayEnergy } from "@/features/diet/components/today-energy";
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
 * It answers two questions and stops. How much of the day is left to eat, and
 * whether training happened. It deliberately carries no quick-action row: the
 * navigation is three centimetres above it, and a second copy of the menu
 * dressed as buttons is not a feature.
 *
 * A client route for the same reason as `/diario` — only the browser knows
 * what today is where the reader is standing.
 */
export default function HomePage() {
  const today = dayKey(new Date());

  return (
    <main className="mx-auto max-w-6xl px-6 py-6 sm:py-10">
      <PageHeader title="Hoje" subtitle={capitalise(formatLongDay(today))} />

      <div className="mt-6 space-y-3">
        <HomeDataProvider>
          <TodayEnergy day={today} />
          <TodayWorkout day={today} />
        </HomeDataProvider>
      </div>
    </main>
  );
}

/** `sexta-feira, 7 de agosto` → `Sexta-feira, 7 de agosto`. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
