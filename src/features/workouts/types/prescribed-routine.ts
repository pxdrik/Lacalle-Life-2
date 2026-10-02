import type { Weekday } from "@/core/domain/weekday";

import type { RoutineExercise } from "./routine";

/**
 * O treino que o treinador publicou para esta conta (Life Pro, migração 0038),
 * como o paciente o guarda no aparelho: só leitura, numa coleção própria,
 * nunca em `routines` (lá o paciente conseguiria editar e apagar, e a
 * sincronização das rotinas dele o mandaria de volta como se fosse dele).
 *
 * Os exercícios têm o formato das rotinas do app, então iniciar e copiar
 * reaproveitam `startSession` e `duplicateRoutine`.
 */
export interface PrescribedRoutine {
  /** O id do treino no servidor. É ele que a sessão guarda em `routineId`. */
  readonly id: string;
  readonly name: string;
  readonly notes: string;
  readonly professionalName: string;
  /** A versão publicada mais nova, a única que vale. */
  readonly version: number;
  /** O que mudou, nas palavras do treinador. Vazio quando ele não escreveu. */
  readonly changeNote: string;
  readonly publishedAt: string;
  readonly exercises: readonly RoutineExercise[];
  /** A versão anterior, para mostrar o que mudou (Etapa 8f). `null` na primeira. */
  readonly previous: {
    readonly version: number;
    readonly exercises: readonly RoutineExercise[];
    readonly weekdays: readonly Weekday[];
  } | null;
  /** Opcionais: sem nenhum, o paciente faz quando quiser. */
  readonly weekdays: readonly Weekday[];
  /** Encerrado o vínculo, o treino fica sem versões novas. */
  readonly linkEnded: boolean;
  /** A versão que o paciente já abriu, só deste aparelho. `0` quando nunca abriu. */
  readonly seenVersion: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}
