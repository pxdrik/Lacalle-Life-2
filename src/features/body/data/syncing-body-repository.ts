import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import { markPending, type SyncTracker } from "@/core/sync/sync-tracker";

import type { BodyEntry } from "../types/body-entry";
import type { BodyRepository } from "./body-repository";

/**
 * Decora um `BodyRepository` local com o outbox — mesmo desenho de
 * `SyncingDietRepository`: grava local primeiro, só depois marca o dia
 * como pendente de envio. Nunca fala com o Supabase diretamente — quem
 * drena a pendência é `composition/sync` (regra 4 do `AGENTS.md`:
 * `features/**` nunca importa `@/composition`).
 */
export class SyncingBodyRepository implements BodyRepository {
  readonly #local: BodyRepository;
  readonly #tracker: Store<SyncTracker>;
  readonly #onPending: (() => void) | undefined;

  /**
   * `onPending`, se passado, dispara depois que a pendência é gravada — ver
   * a doc equivalente em `SyncingDietRepository` para o motivo completo
   * (achado ao vivo: dado editado e nunca enviado porque a tela não foi
   * reaberta antes de trocar de aparelho).
   */
  constructor(
    local: BodyRepository,
    tracker: Store<SyncTracker>,
    onPending?: () => void,
  ) {
    this.#local = local;
    this.#tracker = tracker;
    this.#onPending = onPending;
  }

  listAll(): Promise<readonly BodyEntry[]> {
    return this.#local.listAll();
  }

  listBetween(from: string, to: string): Promise<readonly BodyEntry[]> {
    return this.#local.listBetween(from, to);
  }

  getByDay(day: string): Promise<BodyEntry | undefined> {
    return this.#local.getByDay(day);
  }

  async save(entry: BodyEntry, expectedUpdatedAt: number | null): Promise<void> {
    await this.#local.save(entry, expectedUpdatedAt);
    await markPending(this.#tracker, "bodyEntries", entry.id);
    this.#onPending?.();
  }

  async remove(id: EntityId): Promise<void> {
    await this.#local.remove(id);
    await markPending(this.#tracker, "bodyEntries", id);
    this.#onPending?.();
  }
}
