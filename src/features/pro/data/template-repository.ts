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

/**
 * A Biblioteca da profissional (Etapa 5d). O modelo em si é editado pelo
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
}
