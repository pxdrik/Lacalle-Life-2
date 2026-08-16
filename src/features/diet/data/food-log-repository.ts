import type { EntityId } from "@/core/domain/entity";
import type { StoreDefinition } from "@/core/storage/schema";

import type { FoodLog } from "../types/food-log";

/**
 * Its own store, not a field on the diet.
 *
 * A diet is a handful of documents edited occasionally. A food log grows by
 * one document a day forever, and burying an unbounded series inside the
 * aggregate that every diet screen reads would make those screens heavier
 * every week.
 *
 * Indexed by day so a week or a month can be asked for directly rather than
 * read whole and filtered in memory.
 */
export const FOOD_LOGS_STORE: StoreDefinition = {
  name: "foodLogs",
  keyPath: "id",
  indexes: [{ name: "byDay", keyPath: "day" }],
};

export interface FoodLogRepository {
  /** Every day recorded, oldest first. */
  listAll(): Promise<readonly FoodLog[]>;

  /** Days between two `YYYY-MM-DD` bounds, inclusive. */
  listBetween(from: string, to: string): Promise<readonly FoodLog[]>;

  getByDay(day: string): Promise<FoodLog | undefined>;

  /**
   * Insert or replace. The id is the day, so writing twice corrects.
   * `expectedUpdatedAt` is `null` for a day that has no log yet.
   */
  save(log: FoodLog, expectedUpdatedAt: number | null): Promise<void>;

  remove(id: EntityId): Promise<void>;
}
