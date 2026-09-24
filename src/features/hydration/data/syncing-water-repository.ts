import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import { notifyStoreChanged } from "@/core/storage/store-events";
import { markPending, type SyncTracker } from "@/core/sync/sync-tracker";

import type { WaterEntry } from "../types/water-entry";
import type { WaterRepository } from "./water-repository";

/**
 * Decora um `WaterRepository` local com o outbox — mesmo desenho de
 * `SyncingBodyRepository`: grava local primeiro, só depois marca o dia como
 * pendente de envio.
 */
export class SyncingWaterRepository implements WaterRepository {
  readonly #local: WaterRepository;
  readonly #tracker: Store<SyncTracker>;
  readonly #onPending: (() => void) | undefined;

  constructor(
    local: WaterRepository,
    tracker: Store<SyncTracker>,
    onPending?: () => void,
  ) {
    this.#local = local;
    this.#tracker = tracker;
    this.#onPending = onPending;
  }

  listAll(): Promise<readonly WaterEntry[]> {
    return this.#local.listAll();
  }

  getByDay(day: string): Promise<WaterEntry | undefined> {
    return this.#local.getByDay(day);
  }

  async save(
    entry: WaterEntry,
    expectedUpdatedAt: number | null,
  ): Promise<void> {
    await this.#local.save(entry, expectedUpdatedAt);
    await markPending(this.#tracker, "waterEntries", entry.id);
    notifyStoreChanged("waterEntries");
    this.#onPending?.();
  }

  async remove(id: EntityId): Promise<void> {
    await this.#local.remove(id);
    await markPending(this.#tracker, "waterEntries", id);
    notifyStoreChanged("waterEntries");
    this.#onPending?.();
  }
}
