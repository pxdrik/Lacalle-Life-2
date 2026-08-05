import type { Entity, EntityId } from "@/core/domain/entity";
import type { NutritionProfile } from "@/core/nutrition";

/**
 * There is one profile, so it has one id.
 *
 * A singleton in a keyed store rather than a separate mechanism: the same
 * repository, the same migration path, and a future multi-profile version is a
 * change of id rather than a change of storage.
 */
export const PROFILE_ID: EntityId = "me";

export interface Profile extends Entity {
  /**
   * Nested rather than flattened, so the engine's own schema stays the shape
   * it validates — and so profile fields that are not nutrition inputs
   * (units, display name) can be added without touching it.
   */
  readonly nutrition: NutritionProfile;
}
