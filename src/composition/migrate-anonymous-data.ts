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
 * `PROFILE`/`foodLog` são as duas únicas entidades com motor de sync
 * (`SyncingProfileRepository`/`SyncingFoodLogRepository` decoram exatamente
 * essas duas). Dietas, Treinos, Sessões, Evolução e exercícios
 * personalizados continuam só locais depois da migração, do jeito que já
 * eram antes desta correção — nenhum mecanismo de sync novo é criado aqui.
 *
 * Marcar "pending" só enfileira o envio; nunca escreve no servidor por
 * conta própria. Quem envia continua sendo `pushProfile`/`pushFoodLog`, com
 * o mesmo OCC de sempre — se a conta já tiver um perfil ou um dia de diário
 * de verdade no servidor, o próximo sync detecta o conflito
 * (`server_updated_at` não bate com `expected: null`) e pede uma escolha
 * explícita, nunca sobrescreve sozinho.
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
