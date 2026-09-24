"use client";

import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { ICONS } from "@/design-system/icons";
import { useHydrationTarget } from "@/features/profile";

import { useWaterDay } from "../hooks/use-water-day";

/**
 * Water, on the home screen — same "support tier, not a card" treatment as
 * `TodayProgress` (`features/body`): one row, no border, right after the
 * hero. Never inside `TodayEnergy` itself — that card's three-macro grid is
 * `MACRO_CODING`, and water was Pedro's explicit "não precisa estar dentro
 * dos macros"; folding it into that grid would contradict the one thing he
 * asked for.
 *
 * Links to `/diario`, where the quick-add buttons actually live — same
 * pattern as `TodayEnergy`'s no-profile branch, which points at the same
 * screen for the same reason: the number here is read-only.
 */
export function TodayHydration({ day }: { readonly day: string }) {
  const { state } = useWaterDay(day);
  const target = useHydrationTarget();

  if (state.status !== "ready") return null;

  const ml = state.entry.ml;

  return (
    <Link
      href="/diario"
      className="flex min-h-(--control-h-sm) min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-sm px-1 py-2 transition-colors duration-150 ease-out hover:bg-muted lg:col-span-2"
    >
      <span className="flex items-center gap-2 text-sm text-ink-muted">
        {/* `text-protein-text` — the only blue this design system has, and
            the one association everyone already reads correctly: water is
            blue. It never collides with the macro grid's own blue (Pedro,
            24/09/2026, "deixar o desenho da água azulzinho"): the two never
            appear as adjacent data points competing for the same colour to
            mean two different things, each carries its own label. */}
        <ICONS.water aria-hidden className="size-4 text-protein-text" />
        Água
      </span>

      <span className="text-sm tabular-nums">
        <span className="font-medium text-ink">{formatDecimal(ml)}</span>
        {target !== null && (
          <span className="text-ink-subtle"> / {formatDecimal(target)}</span>
        )}
        <span className="ml-0.5 text-ink-subtle">mL</span>
      </span>
    </Link>
  );
}
