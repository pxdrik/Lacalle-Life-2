"use client";

import { ArrowDown, ArrowUp, Minus, TrendingUp } from "lucide-react";
import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { Card } from "@/design-system/components/card";

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
 * what this card is allowed to show.
 *
 * The card is absent entirely until something has been weighed. An empty
 * progress card on a fresh install is a promise the app cannot keep yet, and
 * the invitation to start already lives on `/evolucao`.
 */
export function TodayProgress() {
  const progress = useWeightProgress();

  if (progress === null) return null;

  const { latestKg, changeKg } = progress;

  return (
    <Card as="section">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <TrendingUp aria-hidden className="size-4 text-ink-subtle" />
          Progresso
        </h2>
        <Link
          href="/evolucao"
          className="text-sm text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
        >
          Abrir
        </Link>
      </div>

      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-ink">
        {formatDecimal(latestKg, 1)}
        <span className="ml-1 text-base font-normal text-ink-subtle">kg</span>
      </p>

      {changeKg === null ? (
        <p className="mt-1.5 text-xs text-ink-subtle">
          Registre de novo em alguns dias para ver a tendência.
        </p>
      ) : (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <Direction changeKg={changeKg} />
          <span className="tabular-nums">
            {changeKg === 0
              ? "sem mudança"
              : `${formatDecimal(Math.abs(changeKg), 1)} kg`}
          </span>
          <span className="text-ink-subtle">
            nos últimos {PROGRESS_WINDOW_DAYS} dias
          </span>
        </p>
      )}
    </Card>
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
