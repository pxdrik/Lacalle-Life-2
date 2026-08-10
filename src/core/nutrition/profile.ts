import { z } from "zod";

import {
  ACTIVITY_LEVELS,
  BIOLOGICAL_SEXES,
  GOALS,
  INPUT_BOUNDS,
} from "./constants";

/**
 * The inputs a calorie target is derived from.
 *
 * One schema, used on every entry point. Anything that reaches the engine has
 * been parsed by it — the engine's own guards are the second line, not the
 * first.
 */
export const nutritionProfileSchema = z.object({
  sex: z.enum(BIOLOGICAL_SEXES),

  ageYears: z
    .number({ error: "Preencha a idade." })
    .int("Idade deve ser um número inteiro.")
    .min(
      INPUT_BOUNDS.ageYears.min,
      `Idade mínima: ${INPUT_BOUNDS.ageYears.min} anos.`,
    )
    .max(
      INPUT_BOUNDS.ageYears.max,
      `Idade máxima: ${INPUT_BOUNDS.ageYears.max} anos.`,
    ),

  heightCm: z
    .number({ error: "Preencha a altura." })
    .min(
      INPUT_BOUNDS.heightCm.min,
      `Altura mínima: ${INPUT_BOUNDS.heightCm.min} cm.`,
    )
    .max(
      INPUT_BOUNDS.heightCm.max,
      `Altura máxima: ${INPUT_BOUNDS.heightCm.max} cm.`,
    ),

  weightKg: z
    .number({ error: "Preencha o peso." })
    .min(
      INPUT_BOUNDS.weightKg.min,
      `Peso mínimo: ${INPUT_BOUNDS.weightKg.min} kg.`,
    )
    .max(
      INPUT_BOUNDS.weightKg.max,
      `Peso máximo: ${INPUT_BOUNDS.weightKg.max} kg.`,
    ),

  activityLevel: z.enum(ACTIVITY_LEVELS),
  goal: z.enum(GOALS),

  /**
   * Optional. When present the engine uses Katch-McArdle, which keys off lean
   * mass and so handles lean or heavily muscled bodies far better than a
   * weight-only formula.
   */
  bodyFatPercent: z
    .number({ error: "Gordura corporal precisa ser um número." })
    .min(
      INPUT_BOUNDS.bodyFatPercent.min,
      `Gordura corporal mínima: ${INPUT_BOUNDS.bodyFatPercent.min}%.`,
    )
    .max(
      INPUT_BOUNDS.bodyFatPercent.max,
      `Gordura corporal máxima: ${INPUT_BOUNDS.bodyFatPercent.max}%.`,
    )
    .optional(),

  /**
   * Desired weekly change in kg, as a magnitude — the sign comes from `goal`.
   * The engine clamps it to a sustainable rate and says when it did.
   */
  weeklyChangeKg: z
    .number({ error: "Ritmo precisa ser um número." })
    .min(
      INPUT_BOUNDS.weeklyChangeKg.min,
      `Ritmo mínimo: ${INPUT_BOUNDS.weeklyChangeKg.min} kg por semana.`,
    )
    .max(
      INPUT_BOUNDS.weeklyChangeKg.max,
      `Ritmo máximo: ${INPUT_BOUNDS.weeklyChangeKg.max} kg por semana.`,
    )
    .optional(),
});

export type NutritionProfile = z.infer<typeof nutritionProfileSchema>;

export const ACTIVITY_LABELS: Readonly<
  Record<NutritionProfile["activityLevel"], string>
> = {
  sedentary: "Sedentário — pouco ou nenhum exercício",
  light: "Leve — 1 a 3 treinos por semana",
  moderate: "Moderado — 3 a 5 treinos por semana",
  active: "Ativo — 6 a 7 treinos por semana",
  athlete: "Atleta — treino intenso ou duas vezes ao dia",
};

export const GOAL_LABELS: Readonly<Record<NutritionProfile["goal"], string>> = {
  cut: "Perder gordura",
  maintain: "Manter",
  bulk: "Ganhar massa",
};

export const SEX_LABELS: Readonly<Record<NutritionProfile["sex"], string>> = {
  female: "Feminino",
  male: "Masculino",
};
