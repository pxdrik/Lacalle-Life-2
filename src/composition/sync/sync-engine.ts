import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import type { Profile } from "@/features/profile/types/profile";

import { DATABASE_NAME, MIGRATIONS } from "../migrations";
import { pullProfile, pushProfile } from "./profile-sync";
import type { PullProfileResult, PushProfileResult } from "./profile-sync";

export interface ProfileSyncOutcome {
  readonly push: PushProfileResult;
  readonly pull: PullProfileResult;
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
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);

  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const localOnly = new LocalProfileRepository(
    new IndexedDbStore<Profile>(db, PROFILE_STORE.name),
  );

  const push = await pushProfile(supabase, tracker, localOnly);
  const pull = await pullProfile(supabase, tracker, localOnly);

  return { push, pull };
}
