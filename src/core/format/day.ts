/**
 * Calendar days as `YYYY-MM-DD` text.
 *
 * A day is not a timestamp. "3 de março" is the same day whether you were in
 * São Paulo or Lisbon when you wrote it down, and it has no time, no offset
 * and no ambiguity across a DST boundary. Storing it as text keeps it that
 * way; storing it as a `Date` would drag a clock along and eventually shift it.
 *
 * `YYYY-MM-DD` also sorts correctly as a plain string, which is why the body
 * log can use it as a primary key and get chronological ordering for free.
 *
 * Lives in `core` because both the body log and the workout history need it,
 * and a feature importing another feature's helper is how coupling starts.
 */

/**
 * The local calendar day of a moment.
 *
 * Built from the local parts rather than `toISOString()`, which converts to
 * UTC first: someone logging at 21:00 in São Paulo would have their weight
 * filed under tomorrow.
 */
export function dayKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * `2026-08-07` → `07/08/2026`. Returns anything unparseable unchanged.
 *
 * `day` is typed as `string`, but a record read from IndexedDB does not
 * obey the type — a corrupted or hand-edited entry can hand this
 * `undefined` or a number, and `.split` on that used to throw straight
 * through this function and out through whatever rendered it. Every
 * function here treats `day` as `unknown` for that one check, on purpose.
 */
export function formatDay(day: string): string {
  if (typeof day !== "string") return String(day);

  const [year, month, date] = day.split("-");
  if (year === undefined || month === undefined || date === undefined)
    return day;

  return `${date}/${month}/${year}`;
}

/**
 * `2026-08-07` → `sexta-feira, 7 de agosto`.
 *
 * For the one place a date is read rather than scanned: the heading of the
 * screen you open in the morning. `Intl` is given the parts explicitly instead
 * of parsing the string, because `new Date("2026-08-07")` is read as UTC
 * midnight and prints the day before for anyone west of Greenwich.
 */
export function formatLongDay(day: string): string {
  if (typeof day !== "string") return String(day);

  const [year, month, date] = day.split("-").map(Number);
  if (year === undefined || month === undefined || date === undefined)
    return day;

  const parsed = new Date(year, month - 1, date);

  /**
   * Rejects a date the constructor quietly repaired. `new Date(2026, 12, 45)`
   * is not an error — it rolls forward into February and returns a perfectly
   * valid Sunday. A malformed day rendering as a plausible wrong date is worse
   * than rendering as itself, so the parts have to survive the round trip.
   */
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== date
  ) {
    return day;
  }

  return parsed.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** `2026-08-07` → `07/08`, for axis labels where the year is implied. */
export function formatShortDay(day: string): string {
  if (typeof day !== "string") return String(day);

  const [, month, date] = day.split("-");
  if (month === undefined || date === undefined) return day;

  return `${date}/${month}`;
}

/**
 * Whether a day is in the future, compared against the local clock.
 *
 * Used to stop someone recording a weigh-in or a workout that has not happened
 * yet — the one date that is never a correction.
 */
export function isFutureDay(day: string, now = new Date()): boolean {
  return day > dayKey(now);
}
