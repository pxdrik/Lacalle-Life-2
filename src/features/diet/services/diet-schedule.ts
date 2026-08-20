import { revise } from "@/core/domain/entity";

import type { Diet, Weekday } from "../types/diet";

export type { Weekday };

export const WEEKDAYS: readonly Weekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const WEEKEND_DAYS: readonly Weekday[] = ["sat", "sun"];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
  sun: "Dom",
};

/** JS's `Date#getDay()` is 0 = Sunday; ours starts the week on Monday. */
const FROM_JS_DAY: readonly Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export function weekdayOf(date: Date): Weekday {
  return FROM_JS_DAY[date.getDay()]!;
}

/**
 * Reassigns a set of weekdays to `dietId`, taking them away from any other
 * diet that currently holds them.
 *
 * A weekday is a calendar slot, not a tag: it can point at one diet at a
 * time, the same way a given Monday can only be one thing when the Diário
 * asks "what's planned today?". Letting two diets both claim "segunda"
 * would just move the ambiguity from this screen to that one.
 *
 * Returns only the diets that actually changed reference-inequal from their
 * input — callers save the difference, not the whole list.
 */
export function assignWeekdays(
  diets: readonly Diet[],
  dietId: string,
  weekdays: readonly Weekday[],
): readonly Diet[] {
  const claimed = new Set(weekdays);

  return diets.map((diet) => {
    if (diet.id === dietId) {
      const same =
        diet.weekdays.length === weekdays.length &&
        diet.weekdays.every((day) => claimed.has(day));
      return same ? diet : revise(diet, { weekdays });
    }

    const remaining = diet.weekdays.filter((day) => !claimed.has(day));
    return remaining.length === diet.weekdays.length
      ? diet
      : revise(diet, { weekdays: remaining });
  });
}

/** The diet linked to a given weekday, if any. */
export function dietForWeekday(
  diets: readonly Diet[],
  weekday: Weekday,
): Diet | undefined {
  return diets.find((diet) => diet.weekdays.includes(weekday));
}
