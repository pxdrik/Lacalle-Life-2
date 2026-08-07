"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FoodLogDataProvider } from "@/composition/data-providers";
import { dayKey, isFutureDay } from "@/core/format/day";
import { PageHeader } from "@/design-system/components/page-header";
import { FoodLogScreen } from "@/features/diet/components/food-log-screen";

/**
 * The food diary — what was eaten, on a date.
 *
 * A client route on purpose. The day defaults to *today*, and only the browser
 * knows what today is where the reader is standing: a server-rendered default
 * would be a day off for anyone far enough west after 21:00. The same reason
 * `dayKey` is built from local parts rather than `toISOString`.
 */
export default function DiaryPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-6 sm:py-10">
      <PageHeader
        title="Diário"
        subtitle="O que você comeu, dia a dia. A dieta é o plano; isto é o que aconteceu."
      />

      <div className="mt-6">
        <Suspense fallback={null}>
          <FoodLogDataProvider>
            <DayFromUrl />
          </FoodLogDataProvider>
        </Suspense>
      </div>
    </main>
  );
}

function DayFromUrl() {
  const params = useSearchParams();
  const requested = params.get("dia");

  // A day in the future is never a record of anything, and a malformed one in
  // the URL should land somewhere sensible rather than on an error.
  const valid =
    requested !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
    !isFutureDay(requested);

  return <FoodLogScreen day={valid ? requested : dayKey(new Date())} />;
}
