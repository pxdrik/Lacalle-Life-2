import type { Entity, EntityId } from "@/core/domain/entity";

/**
 * The local persistence primitive: a keyed collection of entities with
 * secondary indexes.
 *
 * This is *not* the boundary a remote backend would implement — an HTTP API is
 * not a keyed collection, and forcing one to be would produce a bad API on both
 * sides. Feature repositories are that boundary. `Store` is the shared
 * plumbing their local implementations are built from, which is why it is
 * allowed to speak in index-and-key terms.
 */
export type IndexKey = string | number;

/**
 * A lookup against a secondary index.
 *
 * - `{ equals }` — exact match.
 * - `{ from }`, `{ to }`, or both — an inclusive range.
 * - `{}` — every record that has a value for the index.
 *
 * Modelled as a union so that an exact match cannot be combined with a range.
 * Accepting both and silently preferring one would be a contract two adapters
 * could quietly disagree about; here the compiler rejects it outright.
 */
export type IndexQuery =
  | { readonly equals: IndexKey; readonly from?: never; readonly to?: never }
  | { readonly equals?: never; readonly from?: IndexKey; readonly to?: IndexKey };

export interface Store<T extends Entity> {
  get(id: EntityId): Promise<T | undefined>;

  /** Every record, ordered by id. */
  getAll(): Promise<T[]>;

  /**
   * Records matching `query`, ordered by the index value.
   *
   * Records with no value for the indexed field are absent from the index and
   * are therefore never returned — matching IndexedDB's own semantics.
   */
  getAllByIndex(index: string, query: IndexQuery): Promise<T[]>;

  /** Insert or replace. */
  put(record: T): Promise<void>;

  /** Insert or replace many, atomically. */
  putMany(records: readonly T[]): Promise<void>;

  /** Removing an absent id is a no-op, not an error. */
  remove(id: EntityId): Promise<void>;

  count(): Promise<number>;

  clear(): Promise<void>;
}

/**
 * IndexedDB's ordering for the key types we allow: numbers sort before
 * strings, strings compare by UTF-16 code unit.
 *
 * Both adapters share this so that ordering is a property of the contract
 * rather than of whichever adapter happens to be installed.
 */
export function compareIndexKeys(a: IndexKey, b: IndexKey): number {
  const aIsNumber = typeof a === "number";
  const bIsNumber = typeof b === "number";

  if (aIsNumber !== bIsNumber) return aIsNumber ? -1 : 1;
  if (aIsNumber && bIsNumber) return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
