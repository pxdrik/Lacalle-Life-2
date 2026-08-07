import type { Entity } from "@/core/domain/entity";

import type { MeasurementSite } from "../taxonomy/measurement-sites";

/**
 * Tape measurements in centimetres, one slot per site.
 *
 * Every site is present and `null` means "not measured" — never `0`, which is
 * a real number a chart would happily plot as a collapsed waist.
 */
export type Measurements = Readonly<Record<MeasurementSite, number | null>>;

/**
 * One day's record of the body.
 *
 * **Weight and measurements live in the same entry** because they are taken in
 * the same two minutes, standing in the same bathroom. Splitting them would
 * turn "what was I on 3 March" into a join, and would let the two drift onto
 * different dates for no reason anybody asked for.
 *
 * Every field is nullable. Someone who only ever steps on a scale should be
 * able to do exactly that, and never see an empty measurements table implying
 * they forgot something.
 *
 * **The id is the day.** Identity here really is the date: weighing yourself
 * twice before breakfast is noise, and two points on the same day put a kink
 * in a trend line that means nothing. Logging again for a day you already
 * logged replaces it, which falls out of the id for free instead of needing a
 * uniqueness check nobody would remember to write.
 */
export interface BodyEntry extends Entity {
  /** Local calendar day, `YYYY-MM-DD`. Same value as `id`. */
  readonly day: string;
  readonly weightKg: number | null;
  readonly bodyFatPercent: number | null;
  readonly measurements: Measurements;
  readonly notes: string;
}

/** Whether the entry records anything at all. */
export function isEmptyEntry(entry: BodyEntry): boolean {
  return (
    entry.weightKg === null &&
    entry.bodyFatPercent === null &&
    entry.notes.trim() === "" &&
    Object.values(entry.measurements).every((value) => value === null)
  );
}
