/**
 * Um modelo da Biblioteca (0035, `plan_templates`), como a tela precisa: só
 * da profissional, e independente dos planos. As refeições não passam por
 * aqui; quem as lê é o editor de dieta, pela composição.
 */
export interface PlanTemplate {
  readonly id: string;
  readonly name: string;
  readonly mealCount: number;
  readonly kcal: number;
  readonly updatedAt: string;
}

/** Um modelo de treino da Biblioteca (0040), o par do modelo de plano. */
export interface RoutineTemplate {
  readonly id: string;
  readonly name: string;
  readonly exerciseCount: number;
  readonly setCount: number;
  readonly updatedAt: string;
}

/**
 * A Biblioteca da profissional (Etapa 5d; modelos de treino desde 0040). O modelo em si é editado pelo
 * editor de dieta do app (`composition/template-repository.ts`); este lista,
 * cria, apaga e usa num paciente.
 */
export interface TemplateRepository {
  /** Mais recente primeiro. */
  listTemplates(): Promise<readonly PlanTemplate[]>;
  /** Cria um modelo vazio e devolve o id. */
  createTemplate(name: string): Promise<string>;
  deleteTemplate(id: string): Promise<void>;
  /**
   * Cria um plano novo no vínculo, em rascunho, com uma cópia das refeições
   * do modelo, e devolve o id do plano. Mudar o modelo depois não mexe nele.
   */
  applyToPatient(templateId: string, linkId: string): Promise<string>;

  listRoutineTemplates(): Promise<readonly RoutineTemplate[]>;
  createRoutineTemplate(name: string): Promise<string>;
  deleteRoutineTemplate(id: string): Promise<void>;
  /**
   * Cria um treino novo no vínculo, em rascunho e sem dias, com uma cópia dos
   * exercícios do modelo, e devolve o id do treino.
   */
  applyRoutineToPatient(templateId: string, linkId: string): Promise<string>;
}
