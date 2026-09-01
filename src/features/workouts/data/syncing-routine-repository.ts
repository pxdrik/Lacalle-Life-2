import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import { markPending, type SyncTracker } from "@/core/sync/sync-tracker";

import type { Routine } from "../types/routine";
import type { RoutineRepository } from "./routine-repository";

/**
 * Decora um `RoutineRepository` local com o outbox — mesmo desenho de
 * `SyncingDietRepository`: grava local primeiro, só depois marca a rotina
 * como pendente de envio. Nunca fala com o Supabase diretamente — quem
 * drena a pendência é `composition/sync` (regra 4 do `AGENTS.md`:
 * `features/**` nunca importa `@/composition`).
 */
export class SyncingRoutineRepository implements RoutineRepository {
  readonly #local: RoutineRepository;
  readonly #tracker: Store<SyncTracker>;
  readonly #onPending: (() => void) | undefined;

  /**
   * `onPending`, se passado, dispara depois que a pendência é gravada — ver
   * a doc equivalente em `SyncingProfileRepository` para o motivo completo.
   * Este foi o caso que expôs o problema: o Pedro criou a rotina "Upper" no
   * PC, nunca reabriu `/treinos` depois, e ela nunca chegou no celular.
   */
  constructor(
    local: RoutineRepository,
    tracker: Store<SyncTracker>,
    onPending?: () => void,
  ) {
    this.#local = local;
    this.#tracker = tracker;
    this.#onPending = onPending;
  }

  listAll(): Promise<readonly Routine[]> {
    return this.#local.listAll();
  }

  getById(id: EntityId): Promise<Routine | undefined> {
    return this.#local.getById(id);
  }

  async save(routine: Routine, expectedUpdatedAt: number | null): Promise<void> {
    await this.#local.save(routine, expectedUpdatedAt);
    await markPending(this.#tracker, "routines", routine.id);
    this.#onPending?.();
  }

  async remove(id: EntityId): Promise<void> {
    await this.#local.remove(id);
    await markPending(this.#tracker, "routines", id);
    this.#onPending?.();
  }
}
