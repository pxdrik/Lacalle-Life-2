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
  /**
   * Bookkeeping opaco por entidade, só para quem precisa de mais que um
   * timestamp para saber "o que mudou desde a última sincronização" —
   * `Profile` nunca grava isto. `FoodLog` guarda aqui o último payload de
   * fio sincronizado (refeições vivas + tombstones) para detectar uma
   * exclusão local fresca sem tocar no `Meal` de domínio nem na UI — ver
   * docs/arquitetura-sincronizacao.md §19.5.
   */
  readonly snapshot?: unknown;
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
  snapshot: unknown,
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
    snapshot,
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
  await put(
    tracker,
    store,
    recordId,
    "pending",
    existing?.serverUpdatedAt ?? null,
    existing?.snapshot,
  );
}

/**
 * Marca pendente com uma versão do servidor e um snapshot novos, calculados
 * por um merge limpo (sem conflito) — o único outro lugar, além da
 * resolução de conflito, que tem autoridade para escrever um snapshot.
 * Nunca chamada quando o registro está em `"conflict"` — quem chama já
 * verificou isso antes (o merge não roda enquanto há conflito não
 * resolvido).
 *
 * `serverUpdatedAt` é obrigatório aqui, diferente de `markPending` — quem
 * chama acabou de aprender essa versão num pull, e preservar a antiga (como
 * `markPending` faz de propósito para uma edição local comum) faria o
 * próximo push mandar um `expected` desatualizado e bater conflito à toa.
 */
export async function markPendingWithSnapshot(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  serverUpdatedAt: string,
  snapshot: unknown,
): Promise<void> {
  await put(tracker, store, recordId, "pending", serverUpdatedAt, snapshot);
}

/**
 * Local em dia com o servidor — depois de um push aplicado com sucesso, de
 * um pull sem pendência local, ou de uma resolução de conflito que aceitou
 * o valor do servidor.
 *
 * `snapshot` é opcional e opaco — só quem precisa dele (`FoodLog`) passa um
 * valor; `Profile` nunca passa, e o campo fica `undefined`.
 */
export async function markClean(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  serverUpdatedAt: string | null,
  snapshot?: unknown,
): Promise<void> {
  await put(tracker, store, recordId, "clean", serverUpdatedAt, snapshot);
}

/**
 * Um conflito real foi detectado — por uma corrida no push (`applied:
 * false`) ou por um pull achando uma versão mais nova do servidor enquanto
 * havia uma edição local pendente. A partir daqui o push se recusa a
 * tentar de novo sozinho.
 */
export async function markConflict(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  serverUpdatedAt: string,
  snapshot?: unknown,
): Promise<void> {
  await put(tracker, store, recordId, "conflict", serverUpdatedAt, snapshot);
}

/**
 * Única porta de saída de `"conflict"` para `"pending"` — chamada **apenas**
 * pela resolução explícita de um conflito (`resolveProfileConflict`,
 * `resolveFoodLogConflict`). Nome deliberadamente verboso: nunca deveria
 * parecer uma função de uso comum que um editor futuro chama por engano ao
 * mexer no botão de sincronizar.
 */
export async function forcePendingAfterResolution(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
  snapshot?: unknown,
): Promise<void> {
  const existing = await tracker.get(trackerId(store, recordId));
  await put(
    tracker,
    store,
    recordId,
    "pending",
    existing?.serverUpdatedAt ?? null,
    snapshot ?? existing?.snapshot,
  );
}

/**
 * Reset forçado usado só por restauração de backup (P1-02,
 * `composition/backup.ts`, docs/arquitetura-sincronizacao.md §17.6):
 * restaurar um backup é uma escrita local grande, tratada como qualquer
 * outra mutação local — cada registro reentra na fila de sincronização e
 * tenta subir com a regra de conflito da sua família, nunca um modo
 * especial de "importar para a nuvem".
 *
 * Diferente de `markPending`, **nunca** reaproveita o `serverUpdatedAt` que
 * uma entrada anterior já tinha, e **sobrescreve mesmo um registro em
 * `"conflict"`**:
 *
 * - Reaproveitar o `serverUpdatedAt` antigo seria assumir que o conteúdo
 *   importado descende da última versão que este dispositivo conhecia do
 *   servidor — falso em geral, porque o arquivo pode ser mais antigo (de
 *   antes da última sincronização), mais novo (de outro dispositivo) ou
 *   simplesmente de uma sessão anterior deste mesmo aparelho. Preservar
 *   esse valor arriscaria um push cujo `expected` bate por coincidência com
 *   o servidor e sobrescreve dado mais novo de lá sem detectar nada — a
 *   classe exata de bug que backfillUntracked corrige para "nunca visto",
 *   aqui generalizada para "visto antes, mas não confiável".
 * - Um registro em `"conflict"` no momento do import tinha uma decisão
 *   pendente sobre um conteúdo que "substituir, nunca mesclar" acabou de
 *   apagar — a decisão parada de resolver não descreve mais nada que ainda
 *   exista localmente, então continuar bloqueado nela não protegeria nada.
 *
 * `serverUpdatedAt: null` faz o próximo push tentar uma criação
 * (`p_expected_server_updated_at: null`); se o servidor já tiver uma linha
 * viva para este id, a RPC recusa (`applied: false`) e o motor marca
 * conflito — nunca uma sobrescrita silenciosa.
 */
export async function resetPendingForImport(
  tracker: Store<SyncTracker>,
  store: string,
  recordId: EntityId,
): Promise<void> {
  await put(tracker, store, recordId, "pending", null, undefined);
}

/**
 * Marca pendente todo id desta lista que ainda não tem NENHUMA entrada no
 * tracker — o caso de um registro salvo antes da entidade ganhar
 * sincronização (ou gravado, por qualquer motivo, sem passar pelo
 * `Syncing*Repository` decorado). Sem isto o registro é invisível pra
 * `listPending` para sempre, porque nunca existiu como `"pending"` nem como
 * qualquer outro status — achado ao vivo contra produção (02/09/2026): uma
 * rotina criada um dia antes do sync de `Routine` existir nunca foi
 * pega por nenhuma tentativa de push depois que o recurso chegou.
 *
 * Idempotente e seguro de rodar em todo carregamento: só toca em ids sem
 * entrada nenhuma — um registro já `"clean"`, `"pending"` ou `"conflict"`
 * nunca é alterado por aqui.
 */
export async function backfillUntracked(
  tracker: Store<SyncTracker>,
  store: string,
  recordIds: readonly EntityId[],
): Promise<void> {
  for (const recordId of recordIds) {
    const existing = await tracker.get(trackerId(store, recordId));
    if (existing === undefined) {
      await markPending(tracker, store, recordId);
    }
  }
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
