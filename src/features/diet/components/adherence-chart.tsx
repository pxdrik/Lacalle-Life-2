"use client";

import { useState } from "react";

import { Card } from "@/design-system/components/card";
import { cn } from "@/design-system/cn";

import type { AdherencePoint } from "../services/diet-adherence";

interface Props {
  /** Most recent first, as `adherenceByWeek` returns them. */
  readonly points: readonly AdherencePoint[];
  readonly format: (point: AdherencePoint) => string;
}

/**
 * Adherence per week, as plain divs — the same recipe `VolumeChart`
 * (workouts) uses, not shared with it: that chart scales a bar against the
 * period's own peak, because "kg lifted" has no natural ceiling; a fraction
 * of a plan already has one, 100%, so the two charts draw the same shape
 * from genuinely different math. See that file for the accessibility
 * reasoning this one repeats — real DOM text for the value, not `title`
 * alone; one summary line rather than a number per bar; every bar a real
 * button.
 *
 * A week with `plannedMeals === 0` — no diet was linked to any of its days
 * — draws in gray rather than accent, the same distinction `VolumeChart`
 * draws for a period with nothing done. It is not the same as 0%: 0%
 * checked out of a real plan is still accent-colored, because that *is*
 * data, just a discouraging number.
 */
export function AdherenceChart({ points, format }: Props) {
  const chronological = [...points].reverse();

  const [selected, setSelected] = useState<number | null>(null);
  const activeIndex =
    selected === null
      ? chronological.length - 1
      : Math.min(selected, chronological.length - 1);
  const active = chronological[activeIndex];

  return (
    <Card>
      {active !== undefined && (
        <p className="mb-3 text-sm">
          {active.plannedMeals === 0 ? (
            <span className="text-ink-subtle">
              Nenhuma dieta vinculada · {format(active)}
            </span>
          ) : (
            <>
              <span className="font-medium tabular-nums text-ink">
                {String(active.checkedMeals)} de {String(active.plannedMeals)}
              </span>{" "}
              <span className="text-ink-subtle">
                {active.checkedMeals === 1 && active.plannedMeals === 1
                  ? "refeição planejada"
                  : "refeições planejadas"}{" "}
                · {format(active)}
              </span>
            </>
          )}
        </p>
      )}

      <ul className="flex h-40 items-end gap-1.5 border-b border-line">
        {chronological.map((point, index) => {
          const ratio =
            point.plannedMeals === 0
              ? 0
              : point.checkedMeals / point.plannedMeals;
          const percent = Math.round(ratio * 100);

          return (
            <li
              key={point.startsAt}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <button
                type="button"
                onClick={() => {
                  setSelected(index);
                }}
                aria-pressed={index === activeIndex}
                aria-label={
                  point.plannedMeals === 0
                    ? `${format(point)}: nenhuma dieta vinculada`
                    : `${format(point)}: ${String(point.checkedMeals)} de ${String(point.plannedMeals)} refeições, ${String(percent)}%`
                }
                title={
                  point.plannedMeals === 0
                    ? undefined
                    : `${String(percent)}% · ${String(point.checkedMeals)}/${String(point.plannedMeals)}`
                }
                className="flex h-full w-full flex-col justify-end rounded-sm transition-colors duration-(--duration-micro) ease-out hover:bg-muted focus-visible:bg-muted"
              >
                <span
                  aria-hidden
                  className={
                    point.plannedMeals === 0
                      ? "min-h-0.5 rounded-t-full bg-line-strong"
                      : "min-h-1 rounded-t-full bg-accent transition-[height] duration-(--duration-standard) ease-out"
                  }
                  style={{ height: `${String(Math.max(percent, 1))}%` }}
                />
              </button>
            </li>
          );
        })}
      </ul>

      <ul aria-hidden className="mt-2 flex gap-1.5">
        {chronological.map((point, index) => (
          <li
            key={point.startsAt}
            className={cn(
              "flex-1 truncate text-center text-xs tabular-nums",
              index === activeIndex ? "font-medium text-ink" : "text-ink-subtle",
            )}
          >
            {format(point)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
