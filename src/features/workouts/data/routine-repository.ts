import type { EntityId } from "@/core/domain/entity";
import type { StoreDefinition } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import type { Routine } from "../types/routine";

export const ROUTINES_STORE: StoreDefinition = {
  name: "routines",
  keyPath: "id",
  indexes: [],
};

/**
 * Whole aggregates in and out: a routine is one document, so there is no
 * partial-write path and no way for an exercise to survive its routine.
 */
export interface RoutineRepository {
  /** Most recently edited first — the one you want is the one you just left. */
  listAll(): Promise<readonly Routine[]>;
  getById(id: EntityId): Promise<Routine | undefined>;
  save(routine: Routine): Promise<void>;
  remove(id: EntityId): Promise<void>;
}

export class LocalRoutineRepository implements RoutineRepository {
  readonly #store: Store<Routine>;

  constructor(store: Store<Routine>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly Routine[]> {
    const routines = await this.#store.getAll();
    return routines.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getById(id: EntityId): Promise<Routine | undefined> {
    return this.#store.get(id);
  }

  save(routine: Routine): Promise<void> {
    return this.#store.put(routine);
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }
}
