import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import type { Profile } from "@/features/profile/types/profile";

import { DATABASE_NAME, MIGRATIONS } from "../migrations";
import { pullProfile, pushProfile, resolveProfileConflict } from "./profile-sync";
import type {
  ProfileConflictResolution,
  PullProfileResult,
  PushProfileResult,
} from "./profile-sync";

export interface ProfileSyncOutcome {
  readonly push: PushProfileResult;
  readonly pull: PullProfileResult;
}

async function openProfileSyncStores() {
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const localOnly = new LocalProfileRepository(
    new IndexedDbStore<Profile>(db, PROFILE_STORE.name),
  );
  return { tracker, localOnly };
}

/**
 * Sincroniza `profile` uma vez: empurra a edição local pendente, se houver,
 * depois traz o que o servidor tem. `push` primeiro garante que uma edição
 * local não sincronizada tenta subir antes de qualquer `pull` — embora
 * `pullProfile` já se recuse a sobrescrever uma pendência de qualquer jeito
 * (a ordem é defesa em profundidade, não a única proteção).
 *
 * Sem autenticação, as duas funções voltam `"not-authenticated"` sem
 * lançar — chamar isto num app sem sessão é seguro e não faz nada.
 *
 * Abre o `LocalProfileRepository` **puro** (nunca o `SyncingProfileRepository`
 * usado pela UI) — ver a doc de `pushProfile`/`pullProfile` sobre por quê.
 */
export async function runProfileSync(): Promise<ProfileSyncOutcome> {
  const supabase = getSupabaseBrowserClient();
  const { tracker, localOnly } = await openProfileSyncStores();

  const push = await pushProfile(supabase, tracker, localOnly);
  const pull = await pullProfile(supabase, tracker, localOnly);

  return { push, pull };
}

/**
 * Única forma de destravar um `Profile` em conflito. `remote` tem que vir
 * do resultado `"conflict"` que a UI mostrou na tela — nunca busca de novo
 * aqui, para nunca resolver um par de valores diferente do que o usuário
 * viu ao decidir. Depois de resolver, roda `runProfileSync` de novo para
 * completar o ciclo (enviar, se "manter local"; nada a enviar, se "usar
 * servidor").
 */
export async function resolveProfileConflictAndSync(
  resolution: ProfileConflictResolution,
  remote: Profile,
): Promise<ProfileSyncOutcome> {
  const { tracker, localOnly } = await openProfileSyncStores();
  await resolveProfileConflict(tracker, localOnly, resolution, remote);
  return runProfileSync();
}
