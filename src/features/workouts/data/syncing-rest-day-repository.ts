import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import { notifyStoreChanged } from "@/core/storage/store-events";
import { markPending, type SyncTracker } from "@/core/sync/sync-tracker";

import type { RestDay } from "../types/rest-day";
import type { RestDayRepository } from "./rest-day-repository";

/**
 * Decora o repositório local com o outbox — mesmo desenho de
 * `SyncingWaterRepository`: grava local primeiro, depois marca pendente.
 */
export class SyncingRestDayRepository implements RestDayRepository {
  readonly #local: RestDayRepository;
  readonly #tracker: Store<SyncTracker>;
  readonly #onPending: (() => void) | undefined;

  constructor(
    local: RestDayRepository,
    tracker: Store<SyncTracker>,
    onPending?: () => void,
  ) {
    this.#local = local;
    this.#tracker = tracker;
    this.#onPending = onPending;
  }

  listAll(): Promise<readonly RestDay[]> {
    return this.#local.listAll();
  }

  getByDay(day: string): Promise<RestDay | undefined> {
    return this.#local.getByDay(day);
  }

  async save(restDay: RestDay, expectedUpdatedAt: number | null): Promise<void> {
    await this.#local.save(restDay, expectedUpdatedAt);
    await markPending(this.#tracker, "restDays", restDay.id);
    notifyStoreChanged("restDays");
    this.#onPending?.();
  }

  async remove(id: EntityId): Promise<void> {
    await this.#local.remove(id);
    await markPending(this.#tracker, "restDays", id);
    notifyStoreChanged("restDays");
    this.#onPending?.();
  }
}
