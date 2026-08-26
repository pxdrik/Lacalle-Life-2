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
  // `crypto.randomUUID` requires a secure context — HTTPS, or
  // `http://localhost` specifically. Real deployments are HTTPS, but a bare
  // LAN address (testing a phone against a machine's IP, a proxy that drops
  // TLS) is a plain HTTP origin, where the function does not exist at all —
  // not a slow path, an outright `TypeError` the moment anything tries to
  // create a meal, a diet, a routine (found 26/08/2026: this is why "Criar"
  // and "Adicionar refeição" did nothing on a phone reached over `http://`,
  // every single time, silently). `getRandomValues` carries no such
  // restriction, so it is the fallback — the same CSPRNG, assembled by hand
  // into the v4 shape `randomUUID` would have produced.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Applies changes and stamps `updatedAt`.
 *
 * Every mutation goes through here so that bumping the timestamp is never
 * something a caller can forget — the future sync layer's last-write-wins
 * ordering is only as good as the field's discipline, and it is now also the
 * optimistic-concurrency token `Store.putIfVersionMatches` compares against.
 *
 * `id` and `createdAt` are excluded from `changes`: revising an entity must
 * never be able to change which entity it is.
 */
export function revise<T extends Entity>(
  entity: T,
  changes: Partial<Omit<T, keyof Entity>>,
): T {
  return { ...entity, ...changes, updatedAt: entityTimestamp() };
}

let lastEntityTimestamp = 0;

/**
 * A jump backward larger than this is never the clock ticking — real time
 * does not run backward by a minute. It is `Date.now()` being mocked to a
 * small deterministic value, which every timestamp test in this codebase
 * does. Below this, `now` is trusted outright instead of clamped.
 */
const CLOCK_RESET_THRESHOLD_MS = 60_000;

/**
 * Epoch milliseconds, strictly increasing across every call in this process
 * — except across a clock reset, which resets the baseline instead.
 *
 * `Date.now()` alone has 1ms resolution, and two calls in the same React
 * batch — the exact shape of BUG-008 — can land in the same millisecond. A
 * version token that can repeat is a version token a stale writer can
 * accidentally match, so this clamps forward instead of trusting the clock
 * blindly.
 *
 * `revise()` is not the only caller: every `create*` factory stamps a fresh
 * entity's `createdAt` and `updatedAt` with this too, not a bare
 * `Date.now()`. A create and the edit that follows it a moment later are
 * exactly as capable of landing on the same millisecond as two edits are —
 * and a repository's very first version check after a create is only a real
 * check if that create's own timestamp came from the same clock `revise()`
 * will compare against next.
 *
 * This closes the same-process case by construction. It does not close two
 * different tabs' system clocks independently producing the same
 * millisecond for two genuinely concurrent writes — a residual gap a
 * dedicated integer counter, kept in the store itself, would close
 * completely. Left as a known limitation rather than solved with a schema
 * migration this sprint does not need yet.
 */
export function entityTimestamp(): number {
  const now = Date.now();

  if (lastEntityTimestamp - now > CLOCK_RESET_THRESHOLD_MS) {
    lastEntityTimestamp = now;
    return now;
  }

  lastEntityTimestamp = now > lastEntityTimestamp ? now : lastEntityTimestamp + 1;
  return lastEntityTimestamp;
}
