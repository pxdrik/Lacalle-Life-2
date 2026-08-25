import type { Store } from "@/core/storage/store";
import { markPending, type SyncTracker } from "@/core/sync/sync-tracker";

import { PROFILE_ID, type Profile } from "../types/profile";
import type { ProfileRepository } from "./profile-repository";

/**
 * Decora um `ProfileRepository` local com o outbox — grava local primeiro
 * (a UI nunca espera rede), e só depois marca o registro como pendente de
 * envio. Se `markPending` falhar por algum motivo, a escrita local já
 * aconteceu e o app continua funcionando; a mutação só não vai sincronizar
 * até a próxima tentativa bem-sucedida de enfileirar (que acontece de novo
 * na próxima escrita).
 *
 * Nunca fala com o Supabase diretamente — só grava "há uma pendência" na
 * store local. Quem drena isso e chama a RPC é `composition/sync`, que é
 * o único lugar autorizado a conhecer o Supabase (mesma regra 4 do
 * `AGENTS.md`: `features/**` nunca importa `@/composition`).
 */
export class SyncingProfileRepository implements ProfileRepository {
  readonly #local: ProfileRepository;
  readonly #tracker: Store<SyncTracker>;

  constructor(local: ProfileRepository, tracker: Store<SyncTracker>) {
    this.#local = local;
    this.#tracker = tracker;
  }

  get(): Promise<Profile | undefined> {
    return this.#local.get();
  }

  async save(profile: Profile, expectedUpdatedAt: number | null): Promise<void> {
    await this.#local.save(profile, expectedUpdatedAt);
    await markPending(this.#tracker, "profile", PROFILE_ID);
  }

  async clear(): Promise<void> {
    await this.#local.clear();
    await markPending(this.#tracker, "profile", PROFILE_ID);
  }
}
