import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { markPending, SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";
import { PROFILE_ID } from "@/features/profile/types/profile";

import { exportAnonymousData, importAll, type ImportResult } from "./backup";
import { currentDatabaseName } from "./identity";
import { MIGRATIONS } from "./migrations";

/**
 * "Adicionar meus dados" do diálogo "Encontramos dados salvos neste
 * dispositivo" — a única forma pela qual dados do banco anônimo entram no
 * banco de uma conta, e só por essa ação explícita.
 *
 * Reaproveita inteiramente `importAll`: a origem é o banco anônimo local em
 * vez de um arquivo, mas a validação, o reparo por registro e o "um
 * registro ruim não derruba os outros" são exatamente os mesmos do backup —
 * nenhuma lógica nova de reparo é escrita aqui.
 *
 * **Corrigido pela auditoria P1-02** (`reconcileSyncTrackerAfterImport`,
 * `backup.ts`): `importAll` já marca "pending" sozinho as seis entidades
 * sincronizadas — diets, routines, sessions, bodyEntries, além de profile e
 * foodLog. Antes dessa correção, só profile/foodLog eram marcados
 * explicitamente aqui (o comentário desta função dizia isso), e uma dieta ou
 * rotina criada no banco anônimo ficava sem entrada de tracker até o
 * próximo `backfillUntracked` — o mesmo risco que o P1-02 fechou para
 * restauração de backup em geral.
 *
 * As duas linhas de `markPending` abaixo (profile/foodLog) ficaram
 * redundantes — `importAll` já cobre as duas — mas inofensivas de manter:
 * mesma lógica de defesa em profundidade das chamadas de `backfillUntracked`
 * em `data-providers.tsx`.
 *
 * Marcar "pending" só enfileira o envio; nunca escreve no servidor por
 * conta própria. Quem envia continua sendo `pushProfile`/`pushFoodLog`/
 * `pushAllDiets`/etc., com o mesmo OCC de sempre — se a conta já tiver um
 * perfil, dia de diário, dieta, rotina, sessão ou peso de verdade no
 * servidor, o próximo sync detecta o conflito (`server_updated_at` não bate
 * com `expected: null`) e pede uma escolha explícita, nunca sobrescreve
 * sozinho.
 */
export async function migrateAnonymousDataToCurrentIdentity(): Promise<ImportResult> {
  const anonymous = await exportAnonymousData();
  const result = await importAll(anonymous);
  if (!result.ok) return result;

  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  try {
    const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);

    if (anonymous.stores.profile.length > 0) {
      await markPending(tracker, "profile", PROFILE_ID);
    }
    for (const log of anonymous.stores.foodLogs) {
      await markPending(tracker, "foodLog", log.day);
    }
  } finally {
    db.close();
  }

  return result;
}
