import type { Entity, EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import type { StoreDefinition } from "@/core/storage/schema";

/**
 * O que o motor de sync sabe sobre um registro, por (store, recordId).
 *
 * Duas coisas vivem juntas de propósito, em vez de duas stores separadas:
 * "a última versão do servidor que eu conheço" (`serverUpdatedAt`, usada
 * como `p_expected_server_updated_at` no próximo push) e "tenho uma edição
 * local ainda não enviada" (`pendingPush`). As duas mudam pelos mesmos
 * eventos (push bem-sucedido, pull) e nunca precisam ser lidas separadas.
 *
 * `serverUpdatedAt: null` significa "nunca sincronizado" — o próximo push
 * é uma criação (`p_expected_server_updated_at: null`), exatamente como
 * `expectedUpdatedAt: null` já significa localmente.
 */
export interface SyncTracker extends Entity {
  /** `${store}:${recordId}` — chave composta como string, já que Store<T> só indexa por um campo. */
  readonly id: string;
  readonly store: string;
  readonly recordId: string;
  readonly serverUpdatedAt: string | null;
  readonly pendingPush: boolean;
}

export const SYNC_TRACKER_STORE: StoreDefinition = {
  name: "syncTracker",
  keyPath: "id",
  indexes: [],
};

export function trackerId(store: string, recordId: EntityId): string {
  return `${store}:${recordId}`;
}

/**
 * Marca um registro como tendo uma edição local pendente de envio —
 * chamado depois de toda escrita local bem-sucedida (`save`/`clear`), nunca
 * antes: o outbox só existe pra registrar o que já está gravado localmente.
 *
 * Preserva o `serverUpdatedAt` conhecido se já houver um — enfileirar uma
 * mutação não apaga o que o motor de sync já sabia sobre a última versão
 * vista do servidor.
 */
export async function markPending(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
): Promise<void> {
  const id = trackerId(store, recordId);
  const existing = await tracker.get(id);
  const now = Date.now();

  await tracker.put({
    id,
    store,
    recordId,
    serverUpdatedAt: existing?.serverUpdatedAt ?? null,
    pendingPush: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/** Todos os registros de uma store com uma mutação pendente de envio. */
export async function listPending(
  tracker: Store<SyncTracker>,
  store: string,
): Promise<readonly SyncTracker[]> {
  const all = await tracker.getAll();
  return all.filter((entry) => entry.store === store && entry.pendingPush);
}

/**
 * Chamado depois de um push bem-sucedido (`applied: true`) — grava a nova
 * versão do servidor e desliga a pendência. Um push que falhou por
 * conflito nunca chama isto: a pendência continua lá até resolver.
 */
export async function markPushed(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  serverUpdatedAt: string,
): Promise<void> {
  const id = trackerId(store, recordId);
  const existing = await tracker.get(id);
  const now = Date.now();

  await tracker.put({
    id,
    store,
    recordId,
    serverUpdatedAt,
    pendingPush: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/**
 * Chamado depois de um pull — grava a versão do servidor sem mexer em
 * `pendingPush`: uma edição local ainda não enviada continua pendente
 * mesmo depois de aprender uma versão nova do servidor (é exatamente o
 * gatilho de conflito, não algo que o pull deveria apagar sozinho).
 */
export async function markPulled(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  serverUpdatedAt: string,
): Promise<void> {
  const id = trackerId(store, recordId);
  const existing = await tracker.get(id);
  const now = Date.now();

  await tracker.put({
    id,
    store,
    recordId,
    serverUpdatedAt,
    pendingPush: existing?.pendingPush ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export function getExpectedServerUpdatedAt(
  entry: SyncTracker | undefined,
): string | null {
  return entry?.serverUpdatedAt ?? null;
}
