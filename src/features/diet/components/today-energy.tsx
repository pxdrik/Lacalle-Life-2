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
    return <Skeleton className="h-44 w-full rounded-lg" />;
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

  /**
   * **No card, and that is the whole change.**
   *
   * The ring was the app's most proprietary element sitting inside the same
   * bordered box, at the same radius, with the same title-plus-link header as
   * the three cards below it — which is how a signature reads as a widget. It
   * kept the frame and lost the rank.
   *
   * So the frame goes and the space stays. The ring is centred with room
   * around it, and the macros — which used to sit beside it, competing for the
   * same glance — move below, as the secondary reading they are.
   *
   * The heading survives as `sr-only`. A screen reader still gets the landmark
   * it needs to skip the section; the eye does not get a label competing with
   * the figure it labels. The ring already says `kcal restantes`.
   */
  return (
    <section className="pt-2 pb-1">
      <h2 className="sr-only">Alimentação</h2>

      {targets === null ? (
        // No profile means no ring, so this branch is the whole section. The
        // way into the diary has to live here too: without a target *and*
        // without a way to record, the screen would state a problem and offer
        // nothing. A test holds this — it caught the link going missing when
        // the shared header was removed.
        <div className="mx-auto max-w-lg text-center">
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
          <Link
            href="/diario"
            className="mt-4 inline-block text-sm text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
          >
            {nothingYet ? "Registrar" : "Abrir diário"}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <CalorieRing
              consumed={totals.kcal}
              target={targets.kcal}
              nothingYet={nothingYet}
            />
          </div>

          {/* Below, not beside. The macros keep every number and every bar
              they had; what they lose is the right to the same glance as the
              ring. The link rides with them because the diary is where a
              macro question is answered, and because a second link beside the
              ring would be the widget header coming back. */}
          <div className="mx-auto mt-8 max-w-lg">
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <p className="text-xs text-ink-subtle">Macros de hoje</p>
              <Link
                href="/diario"
                className="text-sm text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
              >
                {nothingYet ? "Registrar" : "Abrir diário"}
              </Link>
            </div>

            <MacroProgress
              totals={totals}
              targets={targets}
              figures={MACRO_FIGURES}
            />
          </div>
        </>
      )}
    </section>
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
  nothingYet,
}: {
  readonly consumed: number;
  readonly target: number;
  readonly nothingYet: boolean;
}) {
  const ratio = target === 0 ? 0 : consumed / target;
  const over = consumed > target;
  const remaining = target - consumed;

  return (
    <div className="relative shrink-0">
      {/* Sized up from 128px flat. This is the figure the screen exists to
          show — the one people open the app to read and then close it — and at
          the old size it was merely one of several things in the card. */}
      <svg
        aria-hidden
        viewBox="0 0 128 128"
        className="size-36 -rotate-90 sm:size-44"
        role="presentation"
      >
        {/* The brand's gradient, and the only place it exists.

            **It runs along the direction the arc travels, not across the box.**
            The svg is rotated −90°, so the stroke starts at twelve o'clock and
            sweeps clockwise: the first half of any day's progress descends the
            right-hand side. `y1`→`y2` therefore maps the ramp onto the arc's
            own path for that half — it opens at the brightest stop where
            progress begins and deepens as it advances.

            Honest about the limit: a gradient that follows a circle exactly is
            a *conic* gradient, which SVG has no native element for. Drawing one
            would mean replacing the stroke with a masked `conic-gradient` div,
            and that would cost the round cap and the `stroke-dashoffset`
            transition — the two things that make this ring feel like the app
            noticing rather than a chart redrawing. Past 50% the ramp mirrors
            back up rather than continuing to deepen. That is the trade, taken
            deliberately. */}
        <defs>
          <linearGradient
            id="ring-progress"
            gradientUnits="userSpaceOnUse"
            x1="64"
            y1="12"
            x2="64"
            y2="116"
          >
            <stop offset="0%" stopColor="var(--ring-from)" />
            <stop offset="100%" stopColor="var(--ring-to)" />
          </linearGradient>
        </defs>

        {/* **Dashed while the day is empty**, and that is the app's own word
            for absence rather than a new one: every empty state in the product
            is a dashed outline with no fill. Before this the ring on a fresh
            morning was a solid grey circle — the most proprietary element in
            the product reading as a disabled widget at the exact moment
            somebody opens the app for the first time.

            The track, never the progress. No gradient, no arc, no invented
            percentage: there is nothing to draw, and the dash says so. */}
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeDasharray={nothingYet ? "2 10" : undefined}
          strokeLinecap={nothingYet ? "round" : undefined}
          className={nothingYet ? "stroke-line-strong" : "stroke-muted"}
        />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={
            CIRCUMFERENCE * (1 - Math.min(Math.max(ratio, 0), 1))
          }
          // Amber past the target, not red: going over is worth noticing and
          // is not a fault, and red is what this app says when something
          // actually broke. See the same reasoning in `MacroProgress`.
          //
          // Flat amber, not a gradient: overshoot is a *state*, and the
          // gradient is the brand saying "this is progressing". Keeping the
          // ramp here would dress a warning in the signature.
          stroke={over ? undefined : "url(#ring-progress)"}
          className={cn(
            "transition-[stroke-dashoffset] duration-500 ease-out",
            over && "stroke-warning",
          )}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl",
            over ? "text-warning" : "text-ink",
          )}
        >
          {formatDecimal(Math.abs(remaining))}
        </p>
        {/* "Restantes" implies something was eaten. On an empty day nothing
            was, and the same 2.067 is the budget rather than a remainder —
            the honest caption for the same true number. */}
        <p className="mt-1 max-w-24 text-xs leading-tight text-ink-subtle">
          {over
            ? "kcal acima da meta"
            : nothingYet
              ? "kcal para hoje"
              : "kcal restantes"}
        </p>
      </div>
    </div>
  );
}
