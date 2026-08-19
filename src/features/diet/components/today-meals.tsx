"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { buttonClasses } from "@/design-system/components/button";
import { Section } from "@/design-system/components/section";
import { Skeleton } from "@/design-system/components/skeleton";
import { ICONS } from "@/design-system/icons";

import { useFoodLogDay } from "../hooks/use-food-log";
import { mealMacros } from "../services/diet-macros";

/**
 * What was eaten today, meal by meal.
 *
 * The hero above it answers *how much*; this answers *what*, which is the
 * question you ask when the first answer is not the one you wanted. Together
 * they are the reason to open the app before lunch rather than after it.
 *
 * It reads the same diary as `TodayEnergy` rather than being handed totals: two
 * components reading one source cannot disagree, and the alternative — passing
 * a summary down — would have them drift the first time one of them learned to
 * filter something out.
 *
 * Meals with no items are skipped. A diet template contributes five named
 * meals to a day the moment it is started, and listing "Café da manhã — 0 kcal"
 * four times over reports a plan as though it were a record.
 *
 * **`Section`, not `Card`.** Second in the reading order the Sprint 8
 * direction sets for Hoje — after the hero, before Treino — and one of two
 * screen-level groupings that no longer draw a border around themselves. The
 * icon that used to sit beside the heading is gone with the card: at this
 * compact a label, a glyph reads as filler rather than as identity.
 */
export function TodayMeals({ day }: { readonly day: string }) {
  const { state } = useFoodLogDay(day);

  if (state.status === "loading") {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  // Silent on error, deliberately. `TodayEnergy` reads the same day from the
  // same repository and already says so out loud; two alerts for one failure
  // reads as two failures.
  if (state.status === "error") return null;

  const eaten = state.log.meals.filter((meal) => meal.items.length > 0);

  return (
    <Section
      title="Alimentação"
      size="compact"
      className="min-w-0"
      action={
        eaten.length > 0 ? (
          <Link
            href="/diario"
            className="text-xs text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
          >
            Abrir diário
          </Link>
        ) : undefined
      }
    >
      {eaten.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y divide-line">
          {eaten.map((meal) => (
            <li
              key={meal.id}
              className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{meal.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-subtle">
                  {meal.items.length}{" "}
                  {meal.items.length === 1 ? "item" : "itens"}
                  {meal.time !== null && ` · ${meal.time}`}
                </p>
              </div>

              <p className="shrink-0 text-sm tabular-nums text-ink-muted">
                <span className="text-ink">
                  {formatDecimal(Math.round(mealMacros(meal).kcal))}
                </span>{" "}
                kcal
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * Icon, a sentence, and the way out — the shape every empty state in the app
 * uses. An empty day is the normal state of every morning, so this one says
 * what happens next rather than apologising for having nothing.
 */
function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <ICONS.diary aria-hidden className="size-8 text-ink-subtle" />
      <p className="text-sm text-ink-muted">Nada registrado hoje ainda.</p>
      <Link href="/diario" className={buttonClasses("secondary", "sm")}>
        <Plus aria-hidden className="size-4" />
        Registrar refeição
      </Link>
    </div>
  );
}
