import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";

import type { FoodLog } from "../types/food-log";
import type { FoodLogRepository } from "./food-log-repository";

export class LocalFoodLogRepository implements FoodLogRepository {
  readonly #store: Store<FoodLog>;

  constructor(store: Store<FoodLog>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly FoodLog[]> {
    return (await this.#store.getAll()).map(normalize).sort(byDay);
  }

  async listBetween(from: string, to: string): Promise<readonly FoodLog[]> {
    const logs = await this.#store.getAllByIndex("byDay", { from, to });
    return logs.map(normalize).sort(byDay);
  }

  async getByDay(day: string): Promise<FoodLog | undefined> {
    // The day is the id, so this needs no index lookup.
    const log = await this.#store.get(day);
    return log === undefined ? undefined : normalize(log);
  }

  save(log: FoodLog): Promise<void> {
    return this.#store.put(log);
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }
}

/**
 * Fills in fields added after a record was written.
 *
 * The type describes what is written today; the database holds whatever some
 * earlier version stored. Reading is the boundary where that difference has to
 * be settled, and settling it here means the rest of the app can treat a
 * `FoodLog` as complete.
 */
function normalize(log: FoodLog): FoodLog {
  return {
    ...log,
    meals: log.meals ?? [],
    dietId: log.dietId ?? null,
  };
}

/** `YYYY-MM-DD` sorts correctly as a string, oldest first. */
function byDay(a: FoodLog, b: FoodLog): number {
  return a.day.localeCompare(b.day);
}
