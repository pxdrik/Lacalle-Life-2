import type { Entity, EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import type { StoreDefinition } from "@/core/storage/schema";

/**
 * `clean` — local em dia com a última versão do servidor conhecida, nada a
 * enviar.
 * `pending` — há uma edição local ainda não enviada.
 * `conflict` — um push perdeu uma corrida (`applied: false`) ou um pull
 * achou uma versão do servidor mais nova que a última conhecida enquanto
 * havia uma edição local pendente. **Bloqueia `pushProfile`** até uma
 * resolução explícita (`resolveProfileConflict`) — nunca um estado que
 * "sincronizar de novo" resolve sozinho. Ver docs/arquitetura-sincronizacao.md
 * §22.3: essa era exatamente a lacuna que deixava um dispositivo sobrescrever
 * o outro em silêncio.
 */
export type SyncStatus = "clean" | "pending" | "conflict";

/**
 * O que o motor de sync sabe sobre um registro, por (store, recordId).
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
  readonly status: SyncStatus;
}

export const SYNC_TRACKER_STORE: StoreDefinition = {
  name: "syncTracker",
  keyPath: "id",
  indexes: [],
};

export function trackerId(store: string, recordId: EntityId): string {
  return `${store}:${recordId}`;
}

async function put(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  status: SyncStatus,
  serverUpdatedAt: string | null,
): Promise<void> {
  const id = trackerId(store, recordId);
  const existing = await tracker.get(id);
  const now = Date.now();

  await tracker.put({
    id,
    store,
    recordId,
    status,
    serverUpdatedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/**
 * Marca uma escrita local pendente de envio — chamado depois de toda
 * escrita local bem-sucedida (`save`/`clear`), nunca antes.
 *
 * Nunca tira um registro de `"conflict"` sozinho: editar por cima de um
 * conflito ainda não resolvido continua bloqueado. Só
 * `forcePendingAfterResolution` — chamada exclusivamente pela resolução
 * explícita de conflito — pode fazer essa transição de volta.
 */
export async function markPending(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
): Promise<void> {
  const existing = await tracker.get(trackerId(store, recordId));
  if (existing?.status === "conflict") return;
  await put(tracker, store, recordId, "pending", existing?.serverUpdatedAt ?? null);
}

/**
 * Local em dia com o servidor — depois de um push aplicado com sucesso, de
 * um pull sem pendência local, ou de uma resolução de conflito que aceitou
 * o valor do servidor.
 */
export async function markClean(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  serverUpdatedAt: string | null,
): Promise<void> {
  await put(tracker, store, recordId, "clean", serverUpdatedAt);
}

/**
 * Um conflito real foi detectado — por uma corrida no push (`applied:
 * false`) ou por um pull achando uma versão mais nova do servidor enquanto
 * havia uma edição local pendente. A partir daqui `pushProfile` se recusa a
 * tentar de novo sozinho.
 */
export async function markConflict(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  serverUpdatedAt: string,
): Promise<void> {
  await put(tracker, store, recordId, "conflict", serverUpdatedAt);
}

/**
 * Única porta de saída de `"conflict"` para `"pending"` — chamada **apenas**
 * pela resolução explícita de "manter a edição local"
 * (`resolveProfileConflict`). Nome deliberadamente verboso: nunca deveria
 * parecer uma função de uso comum que um editor futuro chama por engano ao
 * mexer no botão de sincronizar.
 */
export async function forcePendingAfterResolution(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
): Promise<void> {
  const existing = await tracker.get(trackerId(store, recordId));
  await put(tracker, store, recordId, "pending", existing?.serverUpdatedAt ?? null);
}

/** Todos os registros de uma store com uma mutação pendente de envio (não em conflito). */
export async function listPending(
  tracker: Store<SyncTracker>,
  store: string,
): Promise<readonly SyncTracker[]> {
  const all = await tracker.getAll();
  return all.filter((entry) => entry.store === store && entry.status === "pending");
}

export function getExpectedServerUpdatedAt(
  entry: SyncTracker | undefined,
): string | null {
  return entry?.serverUpdatedAt ?? null;
}
