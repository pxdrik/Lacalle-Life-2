"use client";

import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";
import { useNutritionTargets } from "@/features/profile";

import { useFoodLogDay } from "../hooks/use-food-log";
import { dietMacros } from "../services/diet-macros";
import { MacroProgress } from "./macro-progress";
import { MacroSummary } from "./macro-summary";

const MACRO_FIGURES = ["proteinG", "carbsG", "fatG"] as const;

/**
 * How much of the day is left, in calories.
 *
 * The first question anyone opens a diet app to ask, and the reason the home
 * screen exists at all. It reads the diary rather than keeping a second copy
 * of the day: the numbers here and the numbers in `/diario` are the same
 * numbers, computed the same way, or they would drift apart within a week.
 *
 * The whole card works without a profile — the ring needs a target and simply
 * does not appear without one, leaving the totals, which are true either way.
 * A screen that demanded a profile to say anything would contradict the rule
 * the rest of the app is built on.
 */
export function TodayEnergy({ day }: { readonly day: string }) {
  const { state } = useFoodLogDay(day);
  const targets = useNutritionTargets();

  if (state.status === "loading") {
    return <Skeleton className="h-44 w-full rounded-xl" />;
  }

  if (state.status === "error") {
    return (
      <Card role="alert">
        <p className="text-ink">Não foi possível ler o dia de hoje.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </Card>
    );
  }

  const totals = dietMacros(state.log);
  const nothingYet = totals.kcal === 0;

  return (
    <Card as="section">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-ink">Alimentação</h2>
        <Link
          href="/diario"
          className="text-sm text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
        >
          {nothingYet ? "Registrar" : "Abrir diário"}
        </Link>
      </div>

      {targets === null ? (
        <div className="mt-4">
          <MacroSummary macros={totals} size="lg" />
          <p className="mt-3 text-xs text-ink-subtle">
            Sem meta para comparar.{" "}
            <Link
              href="/perfil"
              className="underline underline-offset-4 hover:text-ink"
            >
              Preencha o perfil
            </Link>{" "}
            se quiser ver quanto ainda cabe no dia.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
          <CalorieRing consumed={totals.kcal} target={targets.kcal} />

          <div className="w-full min-w-0 flex-1">
            <MacroProgress
              totals={totals}
              targets={targets}
              figures={MACRO_FIGURES}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Calories as one shape.
 *
 * The single figure that gets a graphic instead of a bar, because it is the
 * one people check without reading — and because a ring reads as "how much of
 * the day is spent" in a way a horizontal bar does not.
 *
 * The arc is capped at a full turn while the colour carries the overshoot: a
 * ring that wrapped past its own start would draw 110% and 10% identically.
 *
 * `aria-hidden` on the drawing, with the same facts as real text beside it.
 * The transition is neutralised for `prefers-reduced-motion` by the global
 * rule in `globals.css`, so it needs nothing of its own here.
 */
function CalorieRing({
  consumed,
  target,
}: {
  readonly consumed: number;
  readonly target: number;
}) {
  const ratio = target === 0 ? 0 : consumed / target;
  const over = consumed > target;
  const remaining = target - consumed;

  return (
    <div className="relative shrink-0">
      <svg
        aria-hidden
        viewBox="0 0 128 128"
        className="size-32 -rotate-90"
        role="presentation"
      >
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(Math.max(ratio, 0), 1))}
          className={cn(
            "transition-[stroke-dashoffset] duration-500 ease-out",
            over ? "stroke-danger" : "stroke-accent",
          )}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p
          className={cn(
            "font-mono text-2xl font-medium tabular-nums",
            over ? "text-danger" : "text-ink",
          )}
        >
          {formatDecimal(Math.abs(remaining))}
        </p>
        <p className="mt-0.5 max-w-24 text-[0.6875rem] leading-tight text-ink-subtle">
          {over ? "kcal acima da meta" : "kcal restantes"}
        </p>
      </div>
    </div>
  );
}
