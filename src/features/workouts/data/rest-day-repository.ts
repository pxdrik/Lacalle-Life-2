import { DataError } from "@/core/domain/data-error";
import type { EntityId } from "@/core/domain/entity";
import type { StoreDefinition } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import type { RestDay } from "../types/rest-day";

/** Store própria, mesmo motivo de `WATER_ENTRIES_STORE`: série diária sem fim. */
export const REST_DAYS_STORE: StoreDefinition = {
  name: "restDays",
  keyPath: "id",
  indexes: [{ name: "byDay", keyPath: "day" }],
};

export interface RestDayRepository {
  /** Todos, do mais antigo ao mais novo — o backup é quem lê. */
  listAll(): Promise<readonly RestDay[]>;

  getByDay(day: string): Promise<RestDay | undefined>;

  /** `expectedUpdatedAt` é `null` para um dia ainda não marcado. */
  save(restDay: RestDay, expectedUpdatedAt: number | null): Promise<void>;

  /** Desmarca. */
  remove(id: EntityId): Promise<void>;
}

export class LocalRestDayRepository implements RestDayRepository {
  readonly #store: Store<RestDay>;

  constructor(store: Store<RestDay>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly RestDay[]> {
    const all = await this.#store.getAll();
    // `YYYY-MM-DD` ordena certo como texto.
    return [...all].sort((a, b) => a.day.localeCompare(b.day));
  }

  getByDay(day: string): Promise<RestDay | undefined> {
    // O dia é o id: não precisa do índice.
    return this.#store.get(day);
  }

  async save(restDay: RestDay, expectedUpdatedAt: number | null): Promise<void> {
    const result = await this.#store.putIfVersionMatches(restDay, expectedUpdatedAt);
    if (!result.ok) {
      throw new DataError(
        "CONFLICT",
        "Este registro foi alterado em outro lugar desde a última leitura.",
      );
    }
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }
}
