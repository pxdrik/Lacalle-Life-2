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
  readonly #onPending: ((day: string) => void) | undefined;

  /**
   * `onPending`, se passado, dispara com o dia que acabou de ficar pendente
   * — ver a doc equivalente em `SyncingProfileRepository` para o motivo
   * completo. Recebe o dia, e não é sem parâmetro como os outros
   * `Syncing*Repository`, porque `pushFoodLog` (diferente de
   * `pushProfile`/`pushAllDiets`/`pushAllRoutines`) empurra um dia por vez,
   * nunca todos de uma vez — não existe um "push de tudo" para FoodLog.
   */
  constructor(
    local: FoodLogRepository,
    tracker: Store<SyncTracker>,
    onPending?: (day: string) => void,
  ) {
    this.#local = local;
    this.#tracker = tracker;
    this.#onPending = onPending;
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
    this.#onPending?.(log.day);
  }

  async remove(id: EntityId): Promise<void> {
    await this.#local.remove(id);
    // O id de um FoodLog é o próprio dia — ver FOOD_LOGS_STORE.
    await markPending(this.#tracker, "foodLog", id);
    this.#onPending?.(id);
  }
}
