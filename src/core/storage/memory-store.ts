import { DataError } from "@/core/domain/data-error";
import type { Entity, EntityId } from "@/core/domain/entity";

import type { StoreDefinition } from "./schema";
import {
  compareIndexKeys,
  type IndexKey,
  type IndexQuery,
  type Store,
} from "./store";

/**
 * In-memory `Store`.
 *
 * Its purpose is not convenience — it is the second implementation that makes
 * `Store` a real contract rather than a description of whatever IndexedDB
 * happens to do. Both adapters run the same conformance suite, so a behaviour
 * that only one of them has is a test failure, not a surprise in production.
 *
 * Fidelity details that are easy to get wrong and are therefore deliberate:
 *   - records are structurally cloned in and out, because IndexedDB does the
 *     same and callers must never hold a live reference to stored state;
 *   - `getAll` orders by primary key;
 *   - a record with no value at an index's key path is absent from that index.
 */
export class MemoryStore<T extends Entity> implements Store<T> {
  readonly #records = new Map<EntityId, T>();
  readonly #indexes: ReadonlyMap<string, string>;
  readonly #name: string;

  constructor(definition: StoreDefinition) {
    this.#name = definition.name;
    this.#indexes = new Map(
      definition.indexes.map((index) => [index.name, index.keyPath]),
    );
  }

  get(id: EntityId): Promise<T | undefined> {
    const record = this.#records.get(id);
    return Promise.resolve(record === undefined ? undefined : clone(record));
  }

  getAll(): Promise<T[]> {
    const all = [...this.#records.values()]
      .sort((a, b) => compareIndexKeys(a.id, b.id))
      .map(clone);
    return Promise.resolve(all);
  }

  // `async` rather than `Promise.resolve`, so an unknown index surfaces as a
  // rejection — which is how IndexedDB reports it.
  async getAllByIndex(index: string, query: IndexQuery): Promise<T[]> {
    const keyPath = this.#indexes.get(index);
    if (keyPath === undefined) {
      throw new DataError(
        "FAILED",
        `Unknown index "${index}" on store "${this.#name}".`,
      );
    }

    const matches: { key: IndexKey; record: T }[] = [];
    for (const record of this.#records.values()) {
      const key = readIndexKey(record, keyPath);
      if (key !== undefined && matchesQuery(key, query)) {
        matches.push({ key, record });
      }
    }

    matches.sort(
      (a, b) =>
        compareIndexKeys(a.key, b.key) ||
        compareIndexKeys(a.record.id, b.record.id),
    );

    return matches.map((match) => clone(match.record));
  }

  put(record: T): Promise<void> {
    this.#records.set(record.id, clone(record));
    return Promise.resolve();
  }

  putMany(records: readonly T[]): Promise<void> {
    for (const record of records) this.#records.set(record.id, clone(record));
    return Promise.resolve();
  }

  remove(id: EntityId): Promise<void> {
    this.#records.delete(id);
    return Promise.resolve();
  }

  count(): Promise<number> {
    return Promise.resolve(this.#records.size);
  }

  clear(): Promise<void> {
    this.#records.clear();
    return Promise.resolve();
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Resolves a possibly dotted key path, mirroring IndexedDB key path lookup. */
function readIndexKey(record: object, keyPath: string): IndexKey | undefined {
  let current: unknown = record;

  for (const segment of keyPath.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" || typeof current === "number"
    ? current
    : undefined;
}

function matchesQuery(key: IndexKey, query: IndexQuery): boolean {
  if (query.equals !== undefined) return compareIndexKeys(key, query.equals) === 0;
  if (query.from !== undefined && compareIndexKeys(key, query.from) < 0) return false;
  if (query.to !== undefined && compareIndexKeys(key, query.to) > 0) return false;
  return true;
}
