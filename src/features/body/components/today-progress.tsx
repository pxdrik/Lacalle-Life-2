"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { ICONS } from "@/design-system/icons";

import {
  PROGRESS_WINDOW_DAYS,
  useWeightProgress,
} from "../hooks/use-weight-progress";

/**
 * Weight, and whether it is going anywhere, on the home screen.
 *
 * **The direction is drawn; the judgement is not.** An arrow and a magnitude,
 * in ink — never green for down and red for up. This app does not know what
 * anyone is training for: the same −1,2 kg is the point of a cut and a problem
 * mid-bulk, and colouring it would have the home screen congratulate or scold
 * someone for hitting their actual goal. Direction is a fact, and facts are
 * what this row is allowed to show.
 *
 * Absent entirely until something has been weighed. An empty progress row on
 * a fresh install is a promise the app cannot keep yet, and the invitation to
 * start already lives on `/evolucao`.
 *
 * **Support tier, not a card.** Fourth and last in Hoje's reading order —
 * behind the hero, behind Alimentação and Treino — it used to draw the same
 * bordered surface as those two, which put "have you weighed in lately" on
 * equal footing with "how did today go". One row, no border, closes the
 * screen instead of competing on it.
 */
export function TodayProgress() {
  const progress = useWeightProgress();

  if (progress === null) return null;

  const { latestKg, changeKg } = progress;

  return (
    <Link
      href="/evolucao"
      className="flex min-h-(--control-h-sm) min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-sm px-1 py-2 transition-colors duration-150 ease-out hover:bg-muted lg:col-span-2"
    >
      <span className="flex items-center gap-2 text-sm text-ink-muted">
        <ICONS.progress aria-hidden className="size-4 text-ink-subtle" />
        Peso
      </span>

      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm tabular-nums">
        <span className="font-medium text-ink">
          {formatDecimal(latestKg, 1)}
          <span className="ml-0.5 font-normal text-ink-subtle">kg</span>
        </span>

        {changeKg === null ? (
          <span className="text-xs text-ink-subtle">
            Registre de novo em alguns dias
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-ink-subtle">
            <Direction changeKg={changeKg} />
            {changeKg === 0
              ? "sem mudança"
              : `${formatDecimal(Math.abs(changeKg), 1)} kg`}{" "}
            em {PROGRESS_WINDOW_DAYS}d
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * The arrow, and the words behind it.
 *
 * The icon is `aria-hidden` and the sentence it belongs to reads "1,2 kg nos
 * últimos 30 dias" — which is direction-free — so the label carries the part
 * the arrow was drawing. Without it a screen reader is told a magnitude with no
 * sign, which is worse than saying nothing.
 */
function Direction({ changeKg }: { readonly changeKg: number }) {
  if (changeKg === 0) {
    return (
      <>
        <Minus aria-hidden className="size-3.5 shrink-0 text-ink-subtle" />
        <span className="sr-only">estável:</span>
      </>
    );
  }

  const Icon = changeKg > 0 ? ArrowUp : ArrowDown;

  return (
    <>
      <Icon aria-hidden className="size-3.5 shrink-0 text-ink-subtle" />
      <span className="sr-only">{changeKg > 0 ? "subiu" : "desceu"}</span>
    </>
  );
}
