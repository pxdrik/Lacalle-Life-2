/**
 * O acompanhamento (Etapa 6, migração 0039): o que o treinador lê do que o
 * paciente faz, já no formato da tela. As leituras e as contas que precisam
 * da dieta e do treino do app moram na composição
 * (`composition/follow-up-repository.ts`); aqui só o que a tela mostra.
 */

/** O paciente não libera esse item: a tela diz isso, não "erro". */
export const NOT_SHARED = "not-shared" as const;
export type Shared<T> = T | typeof NOT_SHARED;

export interface SetTarget {
  readonly weightKg: number | null;
  readonly reps: number | null;
  readonly durationSeconds: number | null;
}

export interface SessionSet {
  /** O que estava prescrito para a série, quando ela veio de um treino. */
  readonly planned: SetTarget | null;
  /** O que foi feito; `null` quando a série não foi concluída. */
  readonly done: (SetTarget & { readonly rpe: number | null }) | null;
  readonly warmup: boolean;
}

export interface SessionExerciseView {
  readonly exerciseId: string;
  readonly name: string;
  readonly sets: readonly SessionSet[];
  /**
   * A carga da série mais pesada, menos a da mesma comparação no treino
   * anterior com esse exercício. `null` sem carga ou sem treino anterior.
   */
  readonly deltaKg: number | null;
}

export interface PatientSession {
  readonly id: string;
  readonly routineId: string | null;
  readonly name: string;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly setsDone: number;
  readonly setsTotal: number;
  readonly volumeKg: number;
  readonly exercises: readonly SessionExerciseView[];
}

/** Como cada refeição do plano ficou num dia do diário. */
export type MealDayState = "checked" | "edited" | "unchecked";

export interface DiaryDay {
  readonly day: string;
  /** O paciente seguiu uma dieta dele nesse dia, não o plano (Etapa 5e). */
  readonly ownDiet: boolean;
  /** Por refeição do plano (id), quando o dia tem registro. */
  readonly meals: Readonly<Record<string, MealDayState>>;
  readonly eatenKcal: number;
}

export interface DiaryWeek {
  /** As refeições do plano publicado, na ordem dele; vazio sem plano. */
  readonly planMeals: readonly { readonly id: string; readonly name: string }[];
  /** Só os dias com registro. */
  readonly days: readonly DiaryDay[];
}

export interface BodyPoint {
  readonly day: string;
  readonly weightKg: number | null;
  /** Medidas em centímetros, só as preenchidas, na ordem do app (com o nome dele). */
  readonly measurements: readonly { readonly site: string; readonly label: string; readonly cm: number }[];
}

export interface OverviewRow {
  readonly linkId: string;
  readonly lastSessionAt: Shared<number | null>;
  /** Os treinos desde a data pedida, para comparar com os dias prescritos. */
  readonly sessions: Shared<readonly { readonly routineId: string | null; readonly startedAt: number }[]>;
  readonly lastDiaryDay: Shared<string | null>;
  readonly weightNow: Shared<number | null>;
  readonly weightMonthAgo: Shared<number | null>;
}
