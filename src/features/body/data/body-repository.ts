import type { EntityId } from "@/core/domain/entity";
import type { StoreDefinition } from "@/core/storage/schema";

import type { BodyEntry } from "../types/body-entry";

/**
 * Its own store, not a document inside the profile.
 *
 * The profile is one small record that is read on every screen that shows a
 * calorie target. A body log grows by one entry a day forever, and burying an
 * unbounded series inside a record that is read constantly would make every
 * read heavier every week.
 *
 * Indexed by day so a chart can ask for a range instead of reading the whole
 * history and filtering in memory.
 */
export const BODY_ENTRIES_STORE: StoreDefinition = {
  name: "bodyEntries",
  keyPath: "id",
  indexes: [{ name: "byDay", keyPath: "day" }],
};

export interface BodyRepository {
  /** Every entry, oldest first. */
  listAll(): Promise<readonly BodyEntry[]>;

  /** Entries between two `YYYY-MM-DD` days, inclusive. */
  listBetween(from: string, to: string): Promise<readonly BodyEntry[]>;

  getByDay(day: string): Promise<BodyEntry | undefined>;

  /**
   * Insert or replace. The id is the day, so logging twice corrects.
   * `expectedUpdatedAt` is `null` for a day with no entry yet.
   */
  save(entry: BodyEntry, expectedUpdatedAt: number | null): Promise<void>;

  remove(id: EntityId): Promise<void>;
}
