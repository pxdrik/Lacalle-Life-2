import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";

import type { Food } from "../types/food";
import type { FoodRepository } from "./food-repository";

/**
 * `FoodRepository` backed by local storage.
 *
 * Takes a `Store<Food>` rather than reaching for IndexedDB itself, so the same
 * class runs against the in-memory adapter in tests — the repository's own
 * behaviour is what gets tested, not the database underneath it.
 */
export class LocalFoodRepository implements FoodRepository {
  readonly #store: Store<Food>;

  constructor(store: Store<Food>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly Food[]> {
    const foods = await this.#store.getAll();
    return foods.map(normalize).sort(byName);
  }

  async getById(id: EntityId): Promise<Food | undefined> {
    const food = await this.#store.get(id);
    return food === undefined ? undefined : normalize(food);
  }

  save(food: Food): Promise<void> {
    return this.#store.put(food);
  }

  saveMany(foods: readonly Food[]): Promise<void> {
    return this.#store.putMany(foods);
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }

  async isEmpty(): Promise<boolean> {
    return (await this.#store.count()) === 0;
  }
}

/**
 * A record written by an earlier version of the app can be missing a field
 * that has since been added — a local store keeps whatever shape it was given,
 * and the browser holding it may have skipped several releases.
 *
 * Filling defaults on the way out means the rest of the app can treat `Food`
 * as complete, and no destructive migration is ever needed to add a field.
 */
function normalize(food: Food): Food {
  return { ...food, isFavorite: food.isFavorite ?? false };
}

/**
 * IndexedDB orders strings by UTF-16 code unit, which puts every accented
 * name after every unaccented one. A Brazilian catalogue sorted that way is
 * unusable, so ordering is applied here instead of by the index.
 */
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function byName(a: Food, b: Food): number {
  return collator.compare(a.name, b.name);
}
