import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import { markPending, type SyncTracker } from "@/core/sync/sync-tracker";

import type { Diet } from "../types/diet";
import type { DietRepository } from "./diet-repository";

/**
 * Decora um `DietRepository` local com o outbox — mesmo desenho de
 * `SyncingProfileRepository`/`SyncingFoodLogRepository`: grava local
 * primeiro, só depois marca a dieta como pendente de envio. Nunca fala com
 * o Supabase diretamente — quem drena a pendência é `composition/sync`
 * (regra 4 do `AGENTS.md`: `features/**` nunca importa `@/composition`).
 */
export class SyncingDietRepository implements DietRepository {
  readonly #local: DietRepository;
  readonly #tracker: Store<SyncTracker>;
  readonly #onPending: (() => void) | undefined;

  /**
   * `onPending`, se passado, dispara depois que a pendência é gravada — ver
   * a doc equivalente em `SyncingProfileRepository` para o motivo completo
   * (achado ao vivo: dieta editada e nunca enviada porque a tela de Dietas
   * não foi reaberta antes de trocar de aparelho).
   */
  constructor(
    local: DietRepository,
    tracker: Store<SyncTracker>,
    onPending?: () => void,
  ) {
    this.#local = local;
    this.#tracker = tracker;
    this.#onPending = onPending;
  }

  listAll(): Promise<readonly Diet[]> {
    return this.#local.listAll();
  }

  getById(id: EntityId): Promise<Diet | undefined> {
    return this.#local.getById(id);
  }

  async save(diet: Diet, expectedUpdatedAt: number | null): Promise<void> {
    await this.#local.save(diet, expectedUpdatedAt);
    await markPending(this.#tracker, "diets", diet.id);
    this.#onPending?.();
  }

  async remove(id: EntityId): Promise<void> {
    await this.#local.remove(id);
    await markPending(this.#tracker, "diets", id);
    this.#onPending?.();
  }
}
