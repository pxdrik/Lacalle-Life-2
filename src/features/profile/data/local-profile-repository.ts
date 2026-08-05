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

  save(profile: Profile): Promise<void> {
    return this.#store.put(profile);
  }

  clear(): Promise<void> {
    return this.#store.remove(PROFILE_ID);
  }
}
