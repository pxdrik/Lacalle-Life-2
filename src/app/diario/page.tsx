"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FoodLogDataProvider } from "@/composition/data-providers";
import { dayKey } from "@/core/format/day";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { FoodLogScreen } from "@/features/diet/components/food-log-screen";
import { PageShell } from "@/design-system/components/page-shell";

import { FoodLogSyncStatus } from "./food-log-sync-status";

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
    <PageShell padding="tight">
      <PageHeader
        icon={ICONS.diary}
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
    </PageShell>
  );
}

function DayFromUrl() {
  const params = useSearchParams();
  const requested = params.get("dia");

  // Um dia futuro passou a ser um destino válido — é como alguém confere se
  // a dieta vinculada a um dia da semana (`dietForWeekday`) caiu certo antes
  // de a semana chegar lá. Um formato malformado ainda cai em algo sensato
  // em vez de erro.
  const valid = requested !== null && /^\d{4}-\d{2}-\d{2}$/.test(requested);
  const day = valid ? requested : dayKey(new Date());

  return (
    <>
      <FoodLogSyncStatus day={day} />
      <FoodLogScreen day={day} />
    </>
  );
}
