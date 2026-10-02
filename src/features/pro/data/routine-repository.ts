import type { RoutineSummary } from "../types/routine";

/**
 * Os treinos que o treinador prescreve (0038). O rascunho em si é editado
 * pelo editor de treino do app, por outro repositório
 * (`composition/routine-draft-repository.ts`); este contrato cria, lista e
 * publica, como `PlanRepository` faz para o plano alimentar.
 */
export interface ProRoutineRepository {
  listRoutines(linkId: string): Promise<readonly RoutineSummary[]>;
  /** Cria o treino com um rascunho vazio e devolve o id. */
  createRoutine(linkId: string, name: string): Promise<string>;
  /** Publica o rascunho como versão nova e devolve o número dela. */
  publish(routineId: string, changeNote: string): Promise<number>;
}
