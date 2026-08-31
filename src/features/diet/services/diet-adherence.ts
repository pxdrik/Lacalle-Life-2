import { dayKey } from "@/core/format/day";

import { dietForWeekday, weekdayOf } from "./diet-schedule";
import type { Diet } from "../types/diet";
import type { FoodLog } from "../types/food-log";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back the adherence chart looks. Same span `VolumeChart`'s weekly view defaults to. */
export const ADHERENCE_WEEKS = 12;

/**
 * Monday, local time, of the week containing `timestamp`.
 *
 * Duplicated from the identical function in
 * `features/workouts/services/history.ts` rather than imported — a feature
 * reaching into another feature's helper is how coupling starts (the same
 * reasoning `dayKey` itself gives for living in `core` instead). Eight
 * lines is cheaper than that coupling.
 */
function startOfWeek(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);

  return date.getTime();
}

export interface AdherencePoint {
  /** Midnight, local time, of the week's Monday. */
  readonly startsAt: number;
  /** How many of `plannedMeals` were checked. */
  readonly checkedMeals: number;
  /** Total meals across every day this week that had a diet scheduled. */
  readonly plannedMeals: number;
  /** How many days this week had a diet linked to their weekday at all. */
  readonly daysWithPlan: number;
}

/**
 * How much of the plan actually happened, one week at a time.
 *
 * Walks every calendar day in the window, not the logs — a day with a diet
 * scheduled and nothing checked is exactly what adherence exists to show,
 * and starting from `logs` instead would silently drop it. A day whose
 * weekday has no diet linked (`dietForWeekday` finds nothing) contributes
 * to neither side of the fraction: there was no plan that day to be
 * faithful to, which is why `daysWithPlan` exists — a week can legitimately
 * have nothing to measure, and that is different from measuring 0%.
 *
 * "Checked" counts a meal whose `sourceDietId` matches, checked or edited
 * alike — `mealCheckState`'s distinction is about *what* was eaten, not
 * *whether* the plan was followed at all.
 *
 * Every week in the window is seeded, even ones with no plan whatsoever, so
 * a gap in the schedule itself is visible rather than absent — the same
 * reason `volumeByPeriod` (workouts' own history) seeds empty periods.
 */
export function adherenceByWeek(
  diets: readonly Diet[],
  logs: readonly FoodLog[],
  weeks: number,
  now = Date.now(),
): readonly AdherencePoint[] {
  const logByDay = new Map(logs.map((log) => [log.day, log]));

  const buckets = new Map<
    number,
    { checkedMeals: number; plannedMeals: number; daysWithPlan: number }
  >();

  let cursor = startOfWeek(now);
  for (let index = 0; index < weeks; index += 1) {
    buckets.set(cursor, { checkedMeals: 0, plannedMeals: 0, daysWithPlan: 0 });
    cursor = startOfWeek(cursor - DAY_MS);
  }

  // A week's Monday can fall anywhere in the calendar week `now` sits in, so
  // the oldest bucket needs up to six extra days behind it to still catch
  // every day belonging to it.
  const daysToWalk = weeks * 7 + 6;

  for (let offset = 0; offset < daysToWalk; offset += 1) {
    const timestamp = now - offset * DAY_MS;
    const bucket = buckets.get(startOfWeek(timestamp));
    if (bucket === undefined) continue;

    const date = new Date(timestamp);
    const diet = dietForWeekday(diets, weekdayOf(date));
    if (diet === undefined || diet.meals.length === 0) continue;

    const log = logByDay.get(dayKey(date));
    const checked =
      log === undefined
        ? 0
        : log.meals.filter((meal) => meal.sourceDietId === diet.id).length;

    bucket.checkedMeals += Math.min(checked, diet.meals.length);
    bucket.plannedMeals += diet.meals.length;
    bucket.daysWithPlan += 1;
  }

  return [...buckets.entries()]
    .map(([startsAt, totals]) => ({ startsAt, ...totals }))
    .sort((a, b) => b.startsAt - a.startsAt);
}
