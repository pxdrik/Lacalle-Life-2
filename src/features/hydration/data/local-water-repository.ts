import { DataError } from "@/core/domain/data-error";
import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";

import type { WaterEntry } from "../types/water-entry";
import type { WaterRepository } from "./water-repository";

export class LocalWaterRepository implements WaterRepository {
  readonly #store: Store<WaterEntry>;

  constructor(store: Store<WaterEntry>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly WaterEntry[]> {
    const entries = await this.#store.getAll();
    return entries.map(normalize).sort(byDay);
  }

  async getByDay(day: string): Promise<WaterEntry | undefined> {
    // The day is the id, so this needs no index lookup.
    const entry = await this.#store.get(day);
    return entry === undefined ? undefined : normalize(entry);
  }

  async save(
    entry: WaterEntry,
    expectedUpdatedAt: number | null,
  ): Promise<void> {
    const result = await this.#store.putIfVersionMatches(
      entry,
      expectedUpdatedAt,
    );
    if (!result.ok) {
      throw new DataError(
        "CONFLICT",
        `Este registro foi alterado em outro lugar desde a última leitura.`,
      );
    }
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }
}

/** `ml` defaults to 0 for a record written before this field existed. */
function normalize(entry: WaterEntry): WaterEntry {
  return { ...entry, ml: entry.ml ?? 0 };
}

/** `YYYY-MM-DD` sorts correctly as a string, oldest first. */
function byDay(a: WaterEntry, b: WaterEntry): number {
  return a.day.localeCompare(b.day);
}
