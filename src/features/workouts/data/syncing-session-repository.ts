import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";
import { markPending, type SyncTracker } from "@/core/sync/sync-tracker";

import type { Session } from "../types/session";
import type { SessionRepository } from "./session-repository";

/**
 * Decora um `SessionRepository` local com o outbox — mesmo desenho de
 * `SyncingRoutineRepository`, com uma diferença: `save()` só marca
 * pendente quando `finishedAt !== null` (docs/arquitetura-sincronizacao.md
 * §8.4). Uma sessão em andamento é salva a cada série concluída — marcar
 * pendente (e disparar um push) a cada uma dessas gravações encheria a fila
 * de um treino inteiro que nunca deveria sair deste aparelho antes de
 * terminar. O momento em que `finishedAt` deixa de ser `null` é o único
 * gatilho real.
 */
export class SyncingSessionRepository implements SessionRepository {
  readonly #local: SessionRepository;
  readonly #tracker: Store<SyncTracker>;
  readonly #onPending: (() => void) | undefined;

  constructor(
    local: SessionRepository,
    tracker: Store<SyncTracker>,
    onPending?: () => void,
  ) {
    this.#local = local;
    this.#tracker = tracker;
    this.#onPending = onPending;
  }

  listAll(): Promise<readonly Session[]> {
    return this.#local.listAll();
  }

  findInProgress(): Promise<Session | undefined> {
    return this.#local.findInProgress();
  }

  getById(id: EntityId): Promise<Session | undefined> {
    return this.#local.getById(id);
  }

  async save(session: Session, expectedUpdatedAt: number | null): Promise<void> {
    await this.#local.save(session, expectedUpdatedAt);
    if (session.finishedAt !== null) {
      await markPending(this.#tracker, "sessions", session.id);
      this.#onPending?.();
    }
  }

  /**
   * Sempre marca pendente, mesmo apagando uma sessão em andamento que nunca
   * foi sincronizada — sem custo extra: `pushOneSession` já trata "sem
   * registro local, nunca existiu no servidor" como o caso trivial (`expected
   * === null` → `markClean` sem nenhuma chamada de rede), o mesmo caminho
   * que `pushOneDiet`/`pushOneRoutine` já usam para exclusão de um registro
   * nunca enviado.
   */
  async remove(id: EntityId): Promise<void> {
    await this.#local.remove(id);
    await markPending(this.#tracker, "sessions", id);
    this.#onPending?.();
  }
}
