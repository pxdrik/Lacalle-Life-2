import type { PlanSummary } from "../types/plan";

/**
 * Os planos da profissional (0035). O rascunho em si é editado pelo editor de
 * dieta do app, por outro repositório (`composition/plan-draft-repository.ts`);
 * este contrato cria, lista e publica.
 */
export interface PlanRepository {
  listPlans(linkId: string): Promise<readonly PlanSummary[]>;
  /** Cria o plano com um rascunho vazio e devolve o id. */
  createPlan(linkId: string, name: string): Promise<string>;
  /** Publica o rascunho como versão nova e devolve o número dela. */
  publish(planId: string, changeNote: string): Promise<number>;
}

/** O banco recusa publicar sem rascunho: nada mudou desde a última versão. */
export const NO_DRAFT = "no draft";
