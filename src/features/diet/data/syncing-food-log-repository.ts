import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import { markPending, type SyncTracker } from "@/core/sync/sync-tracker";

import type { FoodLog } from "../types/food-log";
import type { FoodLogRepository } from "./food-log-repository";

/**
 * Decora um `FoodLogRepository` local com o outbox — grava local primeiro
 * (a UI nunca espera rede), e só depois marca o dia como pendente de
 * envio. Mesmo desenho de `SyncingProfileRepository`: nunca fala com o
 * Supabase diretamente, só grava "há uma pendência" na store local. Quem
 * drena isso e chama a RPC é `composition/sync`, o único lugar autorizado
 * a conhecer o Supabase (regra 4 do `AGENTS.md`).
 */
export class SyncingFoodLogRepository implements FoodLogRepository {
  readonly #local: FoodLogRepository;
  readonly #tracker: Store<SyncTracker>;

  constructor(local: FoodLogRepository, tracker: Store<SyncTracker>) {
    this.#local = local;
    this.#tracker = tracker;
  }

  listAll(): Promise<readonly FoodLog[]> {
    return this.#local.listAll();
  }

  listBetween(from: string, to: string): Promise<readonly FoodLog[]> {
    return this.#local.listBetween(from, to);
  }

  getByDay(day: string): Promise<FoodLog | undefined> {
    return this.#local.getByDay(day);
  }

  async save(log: FoodLog, expectedUpdatedAt: number | null): Promise<void> {
    await this.#local.save(log, expectedUpdatedAt);
    await markPending(this.#tracker, "foodLog", log.day);
  }

  async remove(id: EntityId): Promise<void> {
    await this.#local.remove(id);
    // O id de um FoodLog é o próprio dia — ver FOOD_LOGS_STORE.
    await markPending(this.#tracker, "foodLog", id);
  }
}
