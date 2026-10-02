import { z } from "zod";

import { copyMeal } from "@/features/diet/services/create-diet";
import { mealMacros } from "@/features/diet/services/diet-macros";
import type { ProSupabaseClient } from "@/features/pro/data/supabase-pro-repository";
import type { TemplateRepository } from "@/features/pro/data/template-repository";

import { mealSchema } from "./backup-schemas";

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
  };
}
