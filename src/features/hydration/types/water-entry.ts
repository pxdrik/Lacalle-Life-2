import type { Entity } from "@/core/domain/entity";

/**
 * One day's water total, in millilitres.
 *
 * **The id is the day**, same convention as `BodyEntry` and `FoodLog`:
 * identity really is the date, and logging again for a day already logged
 * replaces it rather than needing a uniqueness check.
 */
export interface WaterEntry extends Entity {
  /** Local calendar day, `YYYY-MM-DD`. Same value as `id`. */
  readonly day: string;
  readonly ml: number;
}

/** A day with nothing logged is not a day worth storing. */
export function isEmptyEntry(entry: WaterEntry): boolean {
  return entry.ml <= 0;
}
