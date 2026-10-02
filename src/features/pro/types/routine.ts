import type { Weekday } from "@/core/domain/weekday";

/**
 * O treino que o treinador publica para um paciente (migração 0038). Os
 * exercícios ficam no formato das rotinas do app; aqui só o que a tela do
 * Life Pro precisa saber sobre o treino.
 */
export interface RoutineVersion {
  readonly version: number;
  readonly name: string;
  readonly changeNote: string;
  readonly publishedAt: string;
  /** Vazio é "quando quiser". */
  readonly weekdays: readonly Weekday[];
}

export interface RoutineSummary {
  readonly id: string;
  readonly name: string;
  /** Há mudanças que o paciente ainda não vê. */
  readonly hasDraft: boolean;
  /** Mais nova primeiro. Vazia enquanto nada foi publicado. */
  readonly versions: readonly RoutineVersion[];
}
