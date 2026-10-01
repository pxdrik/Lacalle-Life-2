import type { StoreDefinition } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import type { PrescribedPlan } from "../types/prescribed-plan";

/** Fora do backup: o plano é da profissional e volta pela sincronização. */
export const PRESCRIBED_PLANS_STORE: StoreDefinition = {
  name: "prescribedPlans",
  keyPath: "id",
  indexes: [],
};

/**
 * Os planos recebidos, só leitura para o paciente. Quem escreve o conteúdo é
 * a sincronização (`replaceAll`); a tela só marca que viu a versão nova.
 */
export interface PrescribedPlanRepository {
  /** Mais recente primeiro. */
  listAll(): Promise<readonly PrescribedPlan[]>;
  getById(id: string): Promise<PrescribedPlan | undefined>;
  markSeen(id: string, version: number): Promise<void>;
}

export class LocalPrescribedPlanRepository implements PrescribedPlanRepository {
  readonly #store: Store<PrescribedPlan>;

  constructor(store: Store<PrescribedPlan>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly PrescribedPlan[]> {
    const all = await this.#store.getAll();
    return [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  getById(id: string): Promise<PrescribedPlan | undefined> {
    return this.#store.get(id);
  }

  async markSeen(id: string, version: number): Promise<void> {
    const plan = await this.#store.get(id);
    if (plan === undefined || plan.seenVersion >= version) return;
    await this.#store.put({ ...plan, seenVersion: version });
  }

  /**
   * O que o servidor tem passa a ser o que o aparelho tem: plano que sumiu de
   * lá some daqui. Só `seenVersion` é do aparelho e atravessa a troca.
   */
  async replaceAll(plans: readonly Omit<PrescribedPlan, "seenVersion">[]): Promise<void> {
    const current = new Map((await this.#store.getAll()).map((plan) => [plan.id, plan]));
    const next = plans.map((plan) => ({ ...plan, seenVersion: current.get(plan.id)?.seenVersion ?? 0 }));
    const keep = new Set(next.map((plan) => plan.id));
    for (const id of current.keys()) {
      if (!keep.has(id)) await this.#store.remove(id);
    }
    await this.#store.putMany(next);
  }
}
