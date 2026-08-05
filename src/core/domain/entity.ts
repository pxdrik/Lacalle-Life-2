/**
 * The identity and versioning envelope every persisted record carries.
 *
 * `createdAt` / `updatedAt` are epoch milliseconds rather than `Date` because
 * IndexedDB index keys must be primitives that sort naturally, and because a
 * number survives structured cloning and JSON export without ambiguity.
 *
 * `updatedAt` exists today only so that a future sync layer has a
 * last-write-wins discriminator without a migration. It is written on every
 * mutation from day one, so no backfill will ever be needed.
 */
export type EntityId = string;

export interface Entity {
  readonly id: EntityId;
  /** Epoch milliseconds. Never changes after creation. */
  readonly createdAt: number;
  /** Epoch milliseconds. Rewritten on every mutation. */
  readonly updatedAt: number;
}

/**
 * Ids are generated on the client, so they must be collision-free without
 * coordination — a remote backend can accept them verbatim later.
 *
 * Insertion order is never derived from the id: entities that need an order
 * carry it explicitly, so that reordering does not mean rewriting identity.
 */
export function createEntityId(): EntityId {
  return crypto.randomUUID();
}

/**
 * Applies changes and stamps `updatedAt`.
 *
 * Every mutation goes through here so that bumping the timestamp is never
 * something a caller can forget — the future sync layer's last-write-wins
 * ordering is only as good as the field's discipline.
 *
 * `id` and `createdAt` are excluded from `changes`: revising an entity must
 * never be able to change which entity it is.
 */
export function revise<T extends Entity>(
  entity: T,
  changes: Partial<Omit<T, keyof Entity>>,
): T {
  return { ...entity, ...changes, updatedAt: Date.now() };
}
