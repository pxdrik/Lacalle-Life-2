import type { EntityId } from "@/core/domain/entity";

import type { Food } from "../types/food";

/**
 * The persistence boundary for foods.
 *
 * This — not `Store<T>` — is what a remote backend would implement. It speaks
 * in foods rather than in keys and indexes, and it carries domain decisions
 * (ordering is locale-aware, not byte-wise) that belong to the model rather
 * than to whichever database is underneath.
 *
 * Everything above this line — hooks, components, services — depends on this
 * interface and never on an implementation. The ESLint boundary in
 * `eslint.config.mjs` enforces it.
 */
export interface FoodRepository {
  /**
   * Every food, catalogue and custom alike, ordered by name under Brazilian
   * Portuguese collation — so "Açúcar" sorts next to "Abacate" rather than
   * after "Zucchini", which is what byte ordering would do.
   */
  listAll(): Promise<readonly Food[]>;

  getById(id: EntityId): Promise<Food | undefined>;

  save(food: Food): Promise<void>;

  saveMany(foods: readonly Food[]): Promise<void>;

  remove(id: EntityId): Promise<void>;

  /** Whether anything has been stored yet. Drives first-run seeding. */
  isEmpty(): Promise<boolean>;
}
