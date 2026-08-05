import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";

import type { Diet } from "../types/diet";
import type { DietRepository } from "./diet-repository";

export class LocalDietRepository implements DietRepository {
  readonly #store: Store<Diet>;

  constructor(store: Store<Diet>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly Diet[]> {
    const diets = await this.#store.getAll();
    return diets.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getById(id: EntityId): Promise<Diet | undefined> {
    return this.#store.get(id);
  }

  save(diet: Diet): Promise<void> {
    return this.#store.put(diet);
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }
}
