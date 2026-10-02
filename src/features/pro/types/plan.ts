/**
 * O plano alimentar que a profissional publica para um paciente (migração
 * 0035). As refeições ficam no formato das refeições de uma dieta do app;
 * aqui só o que a tela do Life Pro precisa saber sobre o plano.
 */
export interface PlanVersion {
  readonly version: number;
  readonly name: string;
  readonly changeNote: string;
  readonly publishedAt: string;
  /** As refeições como o banco guarda (`Meal[]` de uma dieta). Validadas por quem as lê. */
  readonly meals: unknown;
}

export interface PlanSummary {
  readonly id: string;
  readonly name: string;
  /** Há mudanças que o paciente ainda não vê. */
  readonly hasDraft: boolean;
  /** Mais nova primeiro. Vazia enquanto nada foi publicado. */
  readonly versions: readonly PlanVersion[];
}
