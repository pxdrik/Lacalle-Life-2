import type { EntityId } from "@/core/domain/entity";
import type { StoreDefinition } from "@/core/storage/schema";

import type { WaterEntry } from "../types/water-entry";

/**
 * Its own store, same reasoning as `BODY_ENTRIES_STORE`: an unbounded daily
 * series does not belong inside a record read on every nutrition screen.
 *
 * Indexed by day for the same range-query reason `BODY_ENTRIES_STORE` is —
 * a range read (`listBetween`) is unused today, kept for the day a history
 * view asks for one, the same way `WaterRepository` below stays narrower
 * than `BodyRepository` until something needs it.
 */
export const WATER_ENTRIES_STORE: StoreDefinition = {
  name: "waterEntries",
  keyPath: "id",
  indexes: [{ name: "byDay", keyPath: "day" }],
};

export interface WaterRepository {
  /** Every entry, oldest first — the backup export's only consumer today. */
  listAll(): Promise<readonly WaterEntry[]>;

  getByDay(day: string): Promise<WaterEntry | undefined>;

  /**
   * Insert or replace. The id is the day, so logging twice corrects.
   * `expectedUpdatedAt` is `null` for a day with no entry yet.
   */
  save(entry: WaterEntry, expectedUpdatedAt: number | null): Promise<void>;

  remove(id: EntityId): Promise<void>;
}
