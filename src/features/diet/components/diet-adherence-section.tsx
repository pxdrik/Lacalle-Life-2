"use client";

import Link from "next/link";

import { noticeClasses } from "@/design-system/components/notice";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";

import { useDietAdherence } from "../hooks/use-diet-adherence";
import { adherenceByWeek, ADHERENCE_WEEKS } from "../services/diet-adherence";
import type { AdherencePoint } from "../services/diet-adherence";
import { AdherenceChart } from "./adherence-chart";

/**
 * "% da dieta cumprida" — the bridge from the check on the diet screen to a
 * number worth looking back at.
 *
 * A diet with no weekday linked to it has nothing this section can measure
 * — `adherenceByWeek` walks the calendar, not the diet list, so a diet that
 * exists but is never scheduled contributes to no week at all. That is the
 * empty state below: not "no diets", but "no diet ever told a day what it
 * was for".
 */
export function DietAdherenceSection() {
  // `new Date().getTime()`, not `Date.now()`: the same distinction
  // `diet-editor.tsx` already draws — the React Compiler's purity check
  // flags the latter by name in a component body, not the former.
  const now = new Date().getTime();
  const state = useDietAdherence(now);

  if (state.status === "loading") {
    return (
      <div aria-hidden className="space-y-4">
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className={noticeClasses("danger", "block")}>
        <p className="text-ink">Não foi possível carregar sua aderência.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </div>
    );
  }

  const hasSchedule = state.diets.some((diet) => diet.weekdays.length > 0);

  if (!hasSchedule) {
    return (
      <Card tone="quiet" className="text-center">
        <p className="text-ink">Nenhuma dieta vinculada a dias da semana.</p>
        <p className="mt-1.5 text-sm text-ink-subtle">
          Vincule uma dieta a um ou mais dias, na tela de Dietas, para
          acompanhar aqui quanto do plano você realmente segue.
        </p>
        <Link
          href="/dietas"
          className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
        >
          Ir para as dietas
        </Link>
      </Card>
    );
  }

  const points = adherenceByWeek(state.diets, state.logs, ADHERENCE_WEEKS);

  return (
    <div>
      <h2 className="text-sm font-medium text-ink">Aderência semanal</h2>
      <p className="mt-0.5 text-xs text-ink-subtle">
        Últimas {ADHERENCE_WEEKS} semanas, refeições marcadas contra o
        planejado
      </p>
      <div className="mt-3">
        <AdherenceChart points={points} format={formatWeek} />
      </div>
    </div>
  );
}

function formatWeek(point: AdherencePoint): string {
  const date = new Date(point.startsAt);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}
