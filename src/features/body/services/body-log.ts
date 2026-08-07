import type { BodyEntry, Measurements } from "../types/body-entry";
import { MEASUREMENT_SITES } from "../taxonomy/measurement-sites";

/** A day with nothing measured yet. */
export const EMPTY_MEASUREMENTS: Measurements = Object.fromEntries(
  MEASUREMENT_SITES.map((site) => [site, null]),
) as Measurements;

export function createBodyEntry(day: string): BodyEntry {
  const now = Date.now();

  return {
    id: day,
    day,
    weightKg: null,
    bodyFatPercent: null,
    measurements: EMPTY_MEASUREMENTS,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

/** Oldest first, which is the order a chart reads in. */
export function chronological(
  entries: readonly BodyEntry[],
): readonly BodyEntry[] {
  return [...entries].sort((a, b) => a.day.localeCompare(b.day));
}

export interface TrendPoint {
  readonly day: string;
  readonly value: number;
}

/**
 * The days where this field was actually recorded, oldest first.
 *
 * Days without a reading are skipped rather than interpolated. Drawing a line
 * through a weight nobody measured invents data, and the whole point of the
 * chart is to show what happened.
 */
export function seriesOf(
  entries: readonly BodyEntry[],
  read: (entry: BodyEntry) => number | null,
): readonly TrendPoint[] {
  const points: TrendPoint[] = [];

  for (const entry of chronological(entries)) {
    const value = read(entry);
    if (value !== null) points.push({ day: entry.day, value });
  }

  return points;
}

export interface Change {
  readonly latest: TrendPoint;
  readonly previous: TrendPoint | null;
  /** Latest minus previous, or `null` when there is nothing to compare to. */
  readonly delta: number | null;
}

export function changeIn(points: readonly TrendPoint[]): Change | null {
  const latest = points.at(-1);
  if (latest === undefined) return null;

  const previous = points.at(-2) ?? null;

  return {
    latest,
    previous,
    delta: previous === null ? null : latest.value - previous.value,
  };
}

/**
 * Weight smoothed over a window of readings.
 *
 * Body weight swings a kilo or more between mornings on water alone, so the
 * raw line zigzags and a week of real progress hides inside the noise. The
 * average is what people actually mean when they ask whether they are losing
 * weight.
 *
 * Averaged over the last `size` *readings*, not the last `size` days: someone
 * who weighs in twice a week would otherwise get a mostly-empty window.
 */
export function movingAverage(
  points: readonly TrendPoint[],
  size = 7,
): readonly TrendPoint[] {
  if (size < 2) return points;

  return points.map((point, index) => {
    const from = Math.max(0, index - size + 1);
    const window = points.slice(from, index + 1);
    const total = window.reduce((sum, item) => sum + item.value, 0);

    return { day: point.day, value: total / window.length };
  });
}

/**
 * Moves a day's record to a different day.
 *
 * The id **is** the day, so this mints a different entity rather than editing
 * one — which is why the caller has to delete the original. Everything the
 * person typed comes along; only the identity changes.
 */
export function moveEntryToDay(entry: BodyEntry, day: string): BodyEntry {
  return { ...entry, id: day, day };
}
