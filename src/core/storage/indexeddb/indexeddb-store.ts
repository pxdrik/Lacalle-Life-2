import type { IDBPDatabase } from "idb";

import type { Entity, EntityId } from "@/core/domain/entity";

import { toDataError } from "../errors";
import type { IndexQuery, Store, VersionedWriteResult } from "../store";

/**
 * `Store` backed by an IndexedDB object store.
 *
 * Every operation funnels through `run` so that no `DOMException` escapes into
 * feature code: callers see `DataError` with a code they can branch on.
 */
export class IndexedDbStore<T extends Entity> implements Store<T> {
  readonly #db: IDBPDatabase;
  readonly #name: string;

  constructor(db: IDBPDatabase, name: string) {
    this.#db = db;
    this.#name = name;
  }

  get(id: EntityId): Promise<T | undefined> {
    return run(
      async () => (await this.#db.get(this.#name, id)) as T | undefined,
    );
  }

  getAll(): Promise<T[]> {
    return run(async () => (await this.#db.getAll(this.#name)) as T[]);
  }

  getAllByIndex(index: string, query: IndexQuery): Promise<T[]> {
    return run(async () => {
      const range = toKeyRange(query);
      const records = await this.#db.getAllFromIndex(
        this.#name,
        index,
        range ?? undefined,
      );
      return records as T[];
    });
  }

  put(record: T): Promise<void> {
    return run(async () => {
      await this.#db.put(this.#name, record);
    });
  }

  // One `readwrite` transaction for the get and the put: IndexedDB serializes
  // transactions on the same store, so nothing else can write `record.id`
  // between the check below and the put. Two separate calls — a `get` then a
  // later `put` — would leave exactly that gap open.
  putIfVersionMatches(
    record: T,
    expectedUpdatedAt: number | null,
  ): Promise<VersionedWriteResult<T>> {
    return run(async () => {
      const tx = this.#db.transaction(this.#name, "readwrite");
      const current = (await tx.store.get(record.id)) as T | undefined;
      const currentVersion = current === undefined ? null : current.updatedAt;

      if (currentVersion !== expectedUpdatedAt) {
        await tx.done;
        return { ok: false, current };
      }

      await Promise.all([tx.store.put(record), tx.done]);
      return { ok: true };
    });
  }

  putMany(records: readonly T[]): Promise<void> {
    return run(async () => {
      const tx = this.#db.transaction(this.#name, "readwrite");
      await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
    });
  }

  remove(id: EntityId): Promise<void> {
    return run(async () => {
      await this.#db.delete(this.#name, id);
    });
  }

  count(): Promise<number> {
    return run(() => this.#db.count(this.#name));
  }

  clear(): Promise<void> {
    return run(() => this.#db.clear(this.#name));
  }
}

async function run<R>(operation: () => Promise<R>): Promise<R> {
  try {
    return await operation();
  } catch (cause) {
    throw toDataError(cause);
  }
}

/** `null` means "no bound" — every record present in the index. */
function toKeyRange(query: IndexQuery): IDBKeyRange | null {
  if (query.equals !== undefined) return IDBKeyRange.only(query.equals);

  if (query.from !== undefined && query.to !== undefined) {
    return IDBKeyRange.bound(query.from, query.to);
  }
  if (query.from !== undefined) return IDBKeyRange.lowerBound(query.from);
  if (query.to !== undefined) return IDBKeyRange.upperBound(query.to);

  return null;
}
