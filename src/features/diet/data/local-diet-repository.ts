import { DataError } from "@/core/domain/data-error";
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

  async save(diet: Diet, expectedUpdatedAt: number | null): Promise<void> {
    const result = await this.#store.putIfVersionMatches(
      diet,
      expectedUpdatedAt,
    );
    if (!result.ok) {
      throw new DataError(
        "CONFLICT",
        `Esta dieta foi alterada em outro lugar desde a última leitura.`,
      );
    }
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }
}
