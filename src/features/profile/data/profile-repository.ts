import type { StoreDefinition } from "@/core/storage/schema";

import type { Profile } from "../types/profile";

export const PROFILE_STORE: StoreDefinition = {
  name: "profile",
  keyPath: "id",
  indexes: [],
};

/**
 * The persistence boundary for the profile.
 *
 * Shaped as a singleton rather than as CRUD, because that is what it is —
 * `get()` with no argument cannot be called with the wrong id, and `clear()`
 * says what removing it means: going back to having no targets, not deleting a
 * record.
 */
export interface ProfileRepository {
  /** `undefined` until the user chooses to fill it in. */
  get(): Promise<Profile | undefined>;

  /**
   * `expectedUpdatedAt` is the version this caller last read — `null` when
   * no profile has ever been saved. Throws `DataError("CONFLICT")` instead
   * of overwriting when the stored version has moved since: two tabs each
   * editing the profile used to be a silent last-write-wins, where the
   * second save quietly discarded the first tab's edit and even reset
   * `createdAt`. See the 2026-08-24 adversarial audit, F-01.
   */
  save(profile: Profile, expectedUpdatedAt: number | null): Promise<void>;

  /** Turns targets off again. Diets keep working exactly as before. */
  clear(): Promise<void>;
}
