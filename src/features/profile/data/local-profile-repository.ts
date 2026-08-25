import { DataError } from "@/core/domain/data-error";
import type { Store } from "@/core/storage/store";

import { PROFILE_ID, type Profile } from "../types/profile";
import type { ProfileRepository } from "./profile-repository";

export class LocalProfileRepository implements ProfileRepository {
  readonly #store: Store<Profile>;

  constructor(store: Store<Profile>) {
    this.#store = store;
  }

  get(): Promise<Profile | undefined> {
    return this.#store.get(PROFILE_ID);
  }

  async save(
    profile: Profile,
    expectedUpdatedAt: number | null,
  ): Promise<void> {
    const result = await this.#store.putIfVersionMatches(
      profile,
      expectedUpdatedAt,
    );
    if (!result.ok) {
      throw new DataError(
        "CONFLICT",
        `O perfil foi alterado em outro lugar desde a última leitura.`,
      );
    }
  }

  clear(): Promise<void> {
    return this.#store.remove(PROFILE_ID);
  }
}
