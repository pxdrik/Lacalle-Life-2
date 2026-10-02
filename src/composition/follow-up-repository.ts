import { z } from "zod";

import { MEASUREMENT_SITE_LABELS, MEASUREMENT_SITES } from "@/features/body/taxonomy/measurement-sites";
import { mealMacros } from "@/features/diet/services/diet-macros";
import type { Meal, MealItem } from "@/features/diet/types/diet";
import type { FollowUpRepository } from "@/features/pro/data/follow-up-repository";
import type { ProSupabaseClient } from "@/features/pro/data/supabase-pro-repository";
import { NOT_SHARED, type DiaryDay, type MealDayState, type PatientSession, type SessionExerciseView } from "@/features/pro/types/follow-up";
import { sessionProgress, sessionVolumeKg } from "@/features/workouts/services/session-stats";
import { isWarmup, type Session } from "@/features/workouts/types/session";

import { mealSchema, sessionExercisesPayloadSchema } from "./backup-schemas";

/**
 * O acompanhamento do Life Pro (Etapa 6) sobre as funções da 0039. Mora na
 * composição pelo mesmo motivo da Biblioteca: junta o Life Pro com a dieta e
 * o treino do app. As contas são as do app (volume sem aquecimento, séries
 * concluídas), para o treinador e o paciente verem os mesmos números.
 *
 * Nada disto vai para o IndexedDB do treinador: é lido na hora.
 */
const numeric = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value) => (value === null ? null : Number(value)));
const bigint = z.union([z.number(), z.string()]).transform(Number);
// `date` chega como "2026-10-01" do Supabase; outros clientes mandam a data com hora.
const day = z.string().transform((value) => value.slice(0, 10));

const sessionRow = z.object({
  id: z.string(),
  routine_id: z.string().nullable(),
  name: z.string(),
  started_at: bigint,
  finished_at: bigint,
  payload: z.unknown(),
});

// Como o diário viaja (`food-log-sync.ts`): cada refeição pode trazer a lápide.
const diaryRow = z.object({
  day,
  payload: z.object({ meals: z.array(mealSchema.extend({ deletedAt: z.string().nullable().optional() })), dietId: z.string().nullable() }),
});

const bodyRow = z.object({
  day,
  weight_kg: numeric,
  measurements: z.record(z.string(), z.unknown()).nullable(),
});

const overviewRow = z.object({
  link_id: z.string(),
  share_diary: z.boolean(),
  share_body: z.boolean(),
  share_workouts: z.boolean(),
  last_session_at: bigint.nullable(),
  sessions: z.array(z.object({ routineId: z.string().nullable(), startedAt: bigint })).nullable(),
  last_diary_day: day.nullable(),
  weight_now: numeric,
  weight_month_ago: numeric,
});

/** O banco recusa com "not shared" o item que o paciente não libera. */
function shared<T>(error: { readonly message: string } | null, value: () => T): T | typeof NOT_SHARED {
  if (error !== null) {
    if (error.message.includes("not shared")) return NOT_SHARED;
    throw new Error(error.message);
  }
  return value();
}

export function createFollowUpRepository(client: ProSupabaseClient): FollowUpRepository {
  return {
    async listSessions(linkId, since) {
      const { data, error } = await client.rpc("pro_patient_sessions", { p_link_id: linkId, p_since: since });
      return shared(error, () => toSessions(z.array(sessionRow).parse(data)));
    },

    async listDiary(linkId, from, to, plan) {
      const { data, error } = await client.rpc("pro_patient_diary", { p_link_id: linkId, p_from: from, p_to: to });
      return shared(error, () => {
        const planMeals = plan === null ? [] : z.array(mealSchema).catch([]).parse(plan.meals);
        const days = z
          .array(diaryRow)
          .parse(data)
          .map((row) => toDiaryDay(row, plan?.id ?? null, planMeals as readonly Meal[]));
        return { planMeals: planMeals.map((meal) => ({ id: meal.id, name: meal.name })), days };
      });
    },

    async listBody(linkId) {
      const { data, error } = await client.rpc("pro_patient_body", { p_link_id: linkId });
      return shared(error, () =>
        z
          .array(bodyRow)
          .parse(data)
          .map((row) => ({
            day: row.day,
            weightKg: row.weight_kg,
            measurements: MEASUREMENT_SITES.flatMap((site) => {
              const cm = Number(row.measurements?.[site]);
              return row.measurements?.[site] == null || !Number.isFinite(cm)
                ? []
                : [{ site, label: MEASUREMENT_SITE_LABELS[site], cm }];
            }),
          })),
      );
    },

    async overview(since) {
      const { data, error } = await client.rpc("pro_overview", { p_since: since });
      if (error !== null) throw new Error(error.message);
      return z
        .array(overviewRow)
        .parse(data)
        .map((row) => ({
          linkId: row.link_id,
          lastSessionAt: row.share_workouts ? row.last_session_at : NOT_SHARED,
          sessions: row.share_workouts ? (row.sessions ?? []) : NOT_SHARED,
          lastDiaryDay: row.share_diary ? row.last_diary_day : NOT_SHARED,
          weightNow: row.share_body ? row.weight_now : NOT_SHARED,
          weightMonthAgo: row.share_body ? row.weight_month_ago : NOT_SHARED,
        }));
    },
  };
}

/**
 * Os treinos no formato da tela, com a carga comparada ao treino anterior
 * com o mesmo exercício. Um treino ilegível é pulado, como na sincronização:
 * um registro antigo não pode esconder os outros.
 */
export function toSessions(rows: readonly z.infer<typeof sessionRow>[]): readonly PatientSession[] {
  const sessions = rows.flatMap((row): Session[] => {
    const parsed = sessionExercisesPayloadSchema.safeParse(row.payload);
    if (!parsed.success) return [];
    return [
      {
        id: row.id,
        routineId: row.routine_id,
        name: row.name,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        exercises: parsed.data.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({
            ...set,
            durationSeconds: set.durationSeconds ?? null,
            planned: set.planned === null ? null : { ...set.planned, durationSeconds: set.planned.durationSeconds ?? null },
          })),
        })),
        createdAt: row.started_at,
        updatedAt: row.finished_at,
      },
    ];
  });
  const ordered = [...sessions].sort((a, b) => b.startedAt - a.startedAt);

  return ordered.map((session, index) => {
    const older = ordered.slice(index + 1);
    const progress = sessionProgress(session);
    return {
      id: session.id,
      routineId: session.routineId,
      name: session.name,
      startedAt: session.startedAt,
      durationMs: Math.max(0, (session.finishedAt ?? session.startedAt) - session.startedAt),
      setsDone: progress.completed,
      setsTotal: progress.total,
      volumeKg: sessionVolumeKg(session).kg,
      exercises: session.exercises.map((exercise): SessionExerciseView => {
        const best = heaviest(session, exercise.exerciseId);
        const before = older.map((other) => heaviest(other, exercise.exerciseId)).find((kg) => kg !== null) ?? null;
        return {
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          deltaKg: best === null || before === null ? null : best - before,
          sets: exercise.sets.map((set) => ({
            planned:
              set.planned === null
                ? null
                : { weightKg: set.planned.weightKg, reps: set.planned.reps, durationSeconds: set.planned.durationSeconds },
            done: set.isCompleted
              ? { weightKg: set.weightKg, reps: set.reps, durationSeconds: set.durationSeconds, rpe: set.rpe }
              : null,
            warmup: isWarmup(set),
          })),
        };
      }),
    };
  });
}

/** A maior carga concluída do exercício no treino, sem aquecimento. */
function heaviest(session: Session, exerciseId: string): number | null {
  let best: number | null = null;
  for (const exercise of session.exercises) {
    if (exercise.exerciseId !== exerciseId) continue;
    for (const set of exercise.sets) {
      if (!set.isCompleted || isWarmup(set) || set.weightKg === null) continue;
      if (best === null || set.weightKg > best) best = set.weightKg;
    }
  }
  return best;
}

/**
 * Como cada refeição do plano ficou no dia. A refeição do dia se reconhece
 * pela origem (`sourceDietId` + `sourceMealId`), como no Diário. Feita sem
 * mudar os alimentos e as quantidades é "checked"; com mudança, "edited". O
 * Diário compara a referência do array, que não sobrevive à viagem pela
 * rede; aqui a comparação é pelo conteúdo, como em "Opção de hoje".
 */
export function toDiaryDay(row: z.infer<typeof diaryRow>, planId: string | null, planMeals: readonly Meal[]): DiaryDay {
  const meals = row.payload.meals.filter((meal) => meal.deletedAt == null) as readonly Meal[];
  const eaten = meals.filter((meal) => meal.eaten !== false);
  const states: Record<string, MealDayState> = {};
  if (planId !== null) {
    for (const planMeal of planMeals) {
      const logged = meals.find((meal) => meal.sourceDietId === planId && meal.sourceMealId === planMeal.id);
      states[planMeal.id] =
        logged === undefined || logged.eaten === false
          ? "unchecked"
          : signature(logged.items) === signature(logged.plannedSnapshot ?? logged.items)
            ? "checked"
            : "edited";
    }
  }
  return {
    day: row.day,
    ownDiet: row.payload.dietId !== null && row.payload.dietId !== planId,
    meals: states,
    eatenKcal: Math.round(eaten.reduce((sum, meal) => sum + mealMacros(meal).kcal, 0)),
  };
}

function signature(items: readonly MealItem[]): string {
  return items.map((item) => `${item.foodId ?? item.name}:${String(item.grams)}`).join("|");
}
