import type { EntityId } from "@/core/domain/entity";
import type { StoreDefinition } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import type { Session } from "../types/session";

export const SESSIONS_STORE: StoreDefinition = {
  name: "sessions",
  keyPath: "id",
  indexes: [
    /**
     * Sessions are the one store that genuinely grows without bound — one row
     * per workout, forever — and the evolution module reads them by date
     * range. The index is here from the start because adding it later means a
     * migration over data someone has years of.
     */
    { name: "byStartedAt", keyPath: "startedAt" },
  ],
};

export interface SessionRepository {
  /** Most recent first. */
  listAll(): Promise<readonly Session[]>;

  /** The workout still in progress, if there is one. */
  findInProgress(): Promise<Session | undefined>;

  getById(id: EntityId): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
  remove(id: EntityId): Promise<void>;
}

export class LocalSessionRepository implements SessionRepository {
  readonly #store: Store<Session>;

  constructor(store: Store<Session>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly Session[]> {
    const sessions = await this.#store.getAllByIndex("byStartedAt", {});
    return sessions.reverse();
  }

  async findInProgress(): Promise<Session | undefined> {
    const sessions = await this.listAll();
    return sessions.find((session) => session.finishedAt === null);
  }

  getById(id: EntityId): Promise<Session | undefined> {
    return this.#store.get(id);
  }

  save(session: Session): Promise<void> {
    return this.#store.put(session);
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }
}
