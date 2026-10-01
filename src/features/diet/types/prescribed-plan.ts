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
  /**
   * A versão anterior, para mostrar o que mudou. `null` na primeira. Os dias
   * só existem a partir da 0036: um plano guardado antes no aparelho não os
   * tem até a próxima sincronização.
   */
  readonly previous: {
    readonly version: number;
    readonly meals: readonly Meal[];
    readonly weekdays?: readonly Weekday[];
  } | null;
  /**
   * Os dias do plano, escolhidos pela nutricionista e publicados com a versão
   * (0036; padrão, todos). Num dia que também é de uma dieta do paciente, ele
   * escolhe qual vale no Diário (Etapa 5e): ver `dietOfDay` e `dayChoice`.
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
