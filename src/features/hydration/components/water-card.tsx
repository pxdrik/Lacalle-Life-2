"use client";

import { useState } from "react";

import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Input } from "@/design-system/components/input";
import { Skeleton } from "@/design-system/components/skeleton";
import { ICONS } from "@/design-system/icons";
import { useHydrationTarget } from "@/features/profile";

import { useWaterDay } from "../hooks/use-water-day";

const QUICK_ADD_ML = [200, 500] as const;

/**
 * Water, in the Diário — where it's actually logged.
 *
 * Rendered as a sibling of `FoodLogScreen` in `diario/page.tsx`, not inside
 * it: that file is already well past the project's ~250-line guideline, and
 * water needs none of its meal-editing machinery.
 *
 * No progress bar, same reasoning as `MacroSplitDialog`: this app already
 * pulled a colour bar back out of the meal card in favour of the number
 * itself. The total doubles as the correction control — clicking it opens
 * the one text field this card has, rather than adding a second control next
 * to the quick-add buttons for the same job.
 */
export function WaterCard({ day }: { readonly day: string }) {
  const { state, addMl } = useWaterDay(day);
  const target = useHydrationTarget();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (state.status === "loading") {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  if (state.status === "error") {
    return null;
  }

  const ml = state.entry.ml;

  function commitDraft() {
    const next = parseDecimal(draft);
    if (next !== null) addMl(Math.max(0, next) - ml);
    setEditing(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          {/* `text-protein-text` — the only blue in the design system,
              reused for water on purpose (Pedro, 24/09/2026: "o desenho da
              água azulzinho"). See `TodayHydration`'s comment for why this
              never collides with the macro grid's own blue. */}
          <ICONS.water aria-hidden className="size-4 text-protein-text" />
          Água
        </span>

        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              commitDraft();
            }}
          >
            <Input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onBlur={commitDraft}
              className="h-8 w-20 px-2 text-right text-sm"
            />
            <span className="text-xs text-ink-subtle">mL</span>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(formatDecimal(ml));
              setEditing(true);
            }}
            className="rounded-sm text-sm tabular-nums underline-offset-4 hover:underline"
          >
            <span className="font-medium text-ink">{formatDecimal(ml)}</span>
            {target !== null && (
              <span className="text-ink-subtle">
                {" "}
                / {formatDecimal(target)}
              </span>
            )}
            <span className="ml-0.5 text-ink-subtle">mL</span>
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {QUICK_ADD_ML.map((amount) => (
          <Button
            key={amount}
            variant="secondary"
            size="sm"
            onClick={() => {
              addMl(amount);
            }}
          >
            +{amount} mL
          </Button>
        ))}
      </div>
    </Card>
  );
}
