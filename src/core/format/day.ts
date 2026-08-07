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

/** `2026-08-07` → `07/08/2026`. Returns anything unparseable unchanged. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  if (year === undefined || month === undefined || date === undefined) return day;

  return `${date}/${month}/${year}`;
}

/** `2026-08-07` → `07/08`, for axis labels where the year is implied. */
export function formatShortDay(day: string): string {
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
