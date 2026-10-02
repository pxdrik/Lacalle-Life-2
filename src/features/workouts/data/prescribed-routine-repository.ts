import type { StoreDefinition } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import type { PrescribedRoutine } from "../types/prescribed-routine";

/** Fora do backup: o treino é do treinador e volta pela sincronização. */
export const PRESCRIBED_ROUTINES_STORE: StoreDefinition = {
  name: "prescribedRoutines",
  keyPath: "id",
  indexes: [],
};

/**
 * Os treinos recebidos, só leitura para o paciente. Quem escreve o conteúdo é
 * a sincronização (`replaceAll`); a tela só marca que viu a versão nova.
 * O mesmo desenho de `PrescribedPlanRepository`.
 */
export interface PrescribedRoutineRepository {
  /** Mais recente primeiro. */
  listAll(): Promise<readonly PrescribedRoutine[]>;
  markSeen(id: string, version: number): Promise<void>;
}

export class LocalPrescribedRoutineRepository implements PrescribedRoutineRepository {
  readonly #store: Store<PrescribedRoutine>;

  constructor(store: Store<PrescribedRoutine>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly PrescribedRoutine[]> {
    const all = await this.#store.getAll();
    return [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  async markSeen(id: string, version: number): Promise<void> {
    const routine = await this.#store.get(id);
    if (routine === undefined || routine.seenVersion >= version) return;
    await this.#store.put({ ...routine, seenVersion: version });
  }

  /**
   * O que o servidor tem passa a ser o que o aparelho tem: treino que sumiu
   * de lá some daqui. Só `seenVersion` é do aparelho e atravessa a troca.
   */
  async replaceAll(routines: readonly Omit<PrescribedRoutine, "seenVersion">[]): Promise<void> {
    const current = new Map((await this.#store.getAll()).map((routine) => [routine.id, routine]));
    const next = routines.map((routine) => ({ ...routine, seenVersion: current.get(routine.id)?.seenVersion ?? 0 }));
    const keep = new Set(next.map((routine) => routine.id));
    for (const id of current.keys()) {
      if (!keep.has(id)) await this.#store.remove(id);
    }
    await this.#store.putMany(next);
  }
}
