import { Card } from "@/design-system/components/card";

import type { VolumePoint } from "../services/history";
import { formatDecimal } from "@/core/format/decimal";

interface Props {
  /** Most recent first, as the service returns them. */
  readonly points: readonly VolumePoint[];
  readonly format: (point: VolumePoint) => string;
}

/**
 * Volume per period, as plain divs.
 *
 * No charting library. This is a bar per period with a label under it — a
 * hundred kilobytes of Recharts to draw eight rectangles would be the single
 * largest dependency in the app, and it would arrive on a page that renders
 * fine without it.
 *
 * The bars read as a table to a screen reader, which is more useful than any
 * canvas: `role="img"` on a chart says "chart" and stops there.
 */
export function VolumeChart({ points, format }: Props) {
  const chronological = [...points].reverse();
  const peak = Math.max(...chronological.map((point) => point.volumeKg), 1);

  return (
    <Card>
      <ul className="flex h-40 items-end gap-1.5">
        {chronological.map((point) => {
          const height = (point.volumeKg / peak) * 100;

          return (
            <li
              key={point.startsAt}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <span className="sr-only">
                {format(point)}: {formatDecimal(point.volumeKg)} kg em{" "}
                {point.sets} séries
              </span>

              <span
                aria-hidden
                title={`${formatDecimal(point.volumeKg)} kg · ${String(point.sets)} séries`}
                className={
                  point.volumeKg === 0
                    ? "min-h-0.5 rounded-sm bg-line"
                    : "min-h-1 rounded-sm bg-accent transition-[height] duration-300 ease-out"
                }
                style={{ height: `${String(Math.max(height, 1))}%` }}
              />
            </li>
          );
        })}
      </ul>

      <ul aria-hidden className="mt-2 flex gap-1.5">
        {chronological.map((point) => (
          <li
            key={point.startsAt}
            className="flex-1 truncate text-center text-[0.625rem] tabular-nums text-ink-subtle"
          >
            {format(point)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
