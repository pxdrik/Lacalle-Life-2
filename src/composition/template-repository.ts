import { z } from "zod";

import { copyMeal } from "@/features/diet/services/create-diet";
import { mealMacros } from "@/features/diet/services/diet-macros";
import { duplicateRoutine } from "@/features/workouts/services/create-routine";
import type { Routine } from "@/features/workouts/types/routine";
import type { ProSupabaseClient } from "@/features/pro/data/supabase-pro-repository";
import type { TemplateRepository } from "@/features/pro/data/template-repository";

import { mealSchema, routinePayloadSchema } from "./backup-schemas";
import { queuedRepository, type QueuedRepository } from "./plan-draft-repository";

/**
 * A Biblioteca do Life Pro (Etapa 5d) sobre `plan_templates` (0035). Mora na
 * composição porque junta as duas features: o Life Pro não conhece refeição,
 * e a dieta não conhece modelo. Aqui as refeições são lidas, somadas e, ao
 * usar o modelo num paciente, copiadas com ids novos para o rascunho de um
 * plano novo: plano e modelo não compartilham nada depois disso.
 *
 * `pending` espera as gravações do editor de modelo ainda a caminho, para a
 * lista e a cópia nunca lerem o modelo de antes da última mudança.
 */
const row = z.object({ id: z.string(), name: z.string(), meals: z.array(mealSchema), updated_at: z.string() });
const routineRow = z.object({ id: z.string(), name: z.string(), notes: z.string(), exercises: z.unknown(), updated_at: z.string() });

function fail(error: { readonly message: string } | null): void {
  if (error !== null) throw new Error(error.message);
}

export function createTemplateRepository(client: ProSupabaseClient, pending: () => Promise<unknown>): TemplateRepository {
  async function mine() {
    await pending();
    const { data: userData } = await client.auth.getUser();
    if (userData.user === null) throw new Error("not authenticated");
    // Filtro explícito, como em toda leitura do Life Pro, mesmo com a
    // política só deixando ler os próprios (0035).
    const { data, error } = await client
      .from("plan_templates")
      .select("id,name,meals,updated_at")
      .eq("professional_id", userData.user.id);
    fail(error);
    return z.array(row).parse(data);
  }

  async function myRoutines() {
    await pending();
    const { data: userData } = await client.auth.getUser();
    if (userData.user === null) throw new Error("not authenticated");
    const { data, error } = await client
      .from("routine_templates")
      .select("id,name,notes,exercises,updated_at")
      .eq("professional_id", userData.user.id);
    fail(error);
    return z.array(routineRow).parse(data).map((template) => ({ ...template, routine: toRoutine(template.id, template) }));
  }

  return {
    async listTemplates() {
      return (await mine())
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((template) => ({
          id: template.id,
          name: template.name,
          mealCount: template.meals.length,
          kcal: template.meals.reduce((sum, meal) => sum + mealMacros(meal).kcal, 0),
          updatedAt: template.updated_at,
        }));
    },

    async createTemplate(name) {
      const { data, error } = await client.rpc("save_plan_template", { p_template_id: null, p_name: name, p_meals: [] });
      fail(error);
      return z.string().parse(data);
    },

    async deleteTemplate(id) {
      const { error } = await client.rpc("delete_plan_template", { p_template_id: id });
      fail(error);
    },

    async applyToPatient(templateId, linkId) {
      const template = (await mine()).find((candidate) => candidate.id === templateId);
      if (template === undefined) throw new Error("not found");
      // Os dias ficam com o padrão do plano (todos), como num plano novo.
      const { data, error } = await client.rpc("save_plan_draft", {
        p_plan_id: null,
        p_link_id: linkId,
        p_name: template.name,
        p_meals: template.meals.map(copyMeal),
      });
      fail(error);
      return z.string().parse(data);
    },

    async listRoutineTemplates() {
      return (await myRoutines())
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((template) => ({
          id: template.id,
          name: template.name,
          exerciseCount: template.routine.exercises.length,
          setCount: template.routine.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
          updatedAt: template.updated_at,
        }));
    },

    async createRoutineTemplate(name) {
      const { data, error } = await client.rpc("save_routine_template", { p_template_id: null, p_name: name, p_notes: "", p_exercises: [] });
      fail(error);
      return z.string().parse(data);
    },

    async deleteRoutineTemplate(id) {
      const { error } = await client.rpc("delete_routine_template", { p_template_id: id });
      fail(error);
    },

    async applyRoutineToPatient(templateId, linkId) {
      const template = (await myRoutines()).find((candidate) => candidate.id === templateId);
      if (template === undefined) throw new Error("not found");
      // Sem dias: o treinador escolhe os dias deste paciente no treino.
      const { data, error } = await client.rpc("save_routine_draft", {
        p_routine_id: null,
        p_link_id: linkId,
        p_name: template.routine.name,
        p_notes: template.routine.notes,
        p_exercises: duplicateRoutine(template.routine).exercises,
      });
      fail(error);
      return z.string().parse(data);
    },
  };
}

/** Os exercícios como o banco guarda viram uma rotina do app (o `?? null` de `routine-sync.ts`). */
function toRoutine(id: string, raw: { readonly name: string; readonly notes: string; readonly exercises: unknown; readonly updated_at: string }): Routine {
  const parsed = routinePayloadSchema.parse({ name: raw.name === "" ? "Treino" : raw.name, notes: raw.notes, exercises: raw.exercises });
  const updatedAt = Date.parse(raw.updated_at);
  return {
    id,
    name: parsed.name,
    notes: parsed.notes,
    exercises: parsed.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set, durationSeconds: set.durationSeconds ?? null })),
    })),
    createdAt: updatedAt,
    updatedAt,
  };
}

/**
 * Um modelo de treino no editor de treino do app (pelo mesmo caminho do
 * modelo de plano): a "rotina" é a linha de `routine_templates`, gravada por
 * `save_routine_template` em fila.
 */
export function createRoutineTemplateDraftRepository(client: ProSupabaseClient, templateId: string): QueuedRepository<Routine> {
  return queuedRepository<Routine>(
    templateId,
    async () => {
      const { data, error } = await client.from("routine_templates").select("id,name,notes,exercises,updated_at").eq("id", templateId);
      fail(error);
      const [found] = z.array(routineRow).parse(data);
      return found === undefined ? undefined : toRoutine(templateId, found);
    },
    async (routine) => {
      const { error } = await client.rpc("save_routine_template", {
        p_template_id: templateId,
        p_name: routine.name.trim() === "" ? "Treino" : routine.name,
        p_notes: routine.notes,
        p_exercises: routine.exercises,
      });
      fail(error);
    },
    "Um modelo se apaga pela Biblioteca.",
  );
}
