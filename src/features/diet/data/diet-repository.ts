import type { EntityId } from "@/core/domain/entity";

import type { Diet } from "../types/diet";

/**
 * The persistence boundary for diets.
 *
 * Whole aggregates in and out: a diet is saved as one document, so there is no
 * partial-write path and no way for a meal to survive its diet.
 */
export interface DietRepository {
  /** Most recently edited first — the one you want is the one you just left. */
  listAll(): Promise<readonly Diet[]>;

  getById(id: EntityId): Promise<Diet | undefined>;

  save(diet: Diet): Promise<void>;

  remove(id: EntityId): Promise<void>;
}
