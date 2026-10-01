import type { Meal, Weekday } from "./diet";

/**
 * O plano que a nutricionista publicou para esta conta (Life Pro, migração
 * 0035), como o paciente o guarda no aparelho: só leitura, numa coleção
 * própria, nunca em `diets` (lá o paciente conseguiria editar e apagar, e uma
 * versão antiga do app descartaria o campo que não conhece).
 *
 * As refeições têm o formato das refeições de uma dieta: `notes` é a
 * orientação da refeição, `alternatives` são as outras opções.
 */
export interface PrescribedPlan {
  /** O id do plano no servidor. */
  readonly id: string;
  readonly name: string;
  readonly professionalName: string;
  /** A versão publicada mais nova, a única que vale. */
  readonly version: number;
  /** O que mudou, nas palavras da profissional. Vazio quando ela não escreveu. */
  readonly changeNote: string;
  readonly publishedAt: string;
  readonly meals: readonly Meal[];
  /** A versão anterior, para mostrar o que mudou. `null` na primeira. */
  readonly previous: { readonly version: number; readonly meals: readonly Meal[] } | null;
  /**
   * Os dias em que o paciente segue o plano (`plan_schedules`, escolha dele;
   * na primeira publicação, todos). Num dia que também é de uma dieta dele,
   * vale a dieta dele (decisão do Pedro, 01/10/2026): ver `dietOfWeekday`.
   */
  readonly weekdays: readonly Weekday[];
  /** Encerrado o vínculo, o plano fica como leitura, sem versões novas. */
  readonly linkEnded: boolean;
  /**
   * A versão que o paciente já abriu, só deste aparelho. Menor que `version`
   * é o que acende "Atualizado". `0` quando nunca abriu.
   */
  readonly seenVersion: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}
