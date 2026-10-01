import { z } from "zod";

import type { DietRepository } from "@/features/diet/data/diet-repository";
import type { Diet } from "@/features/diet/types/diet";
import type { ProSupabaseClient } from "@/features/pro/data/supabase-pro-repository";

import { mealSchema } from "./backup-schemas";

/**
 * O editor de dieta do app editando o plano que a nutricionista monta no
 * Life Pro (Etapa 5): este repositório se apresenta como `DietRepository`,
 * mas por trás lê e grava o RASCUNHO do plano no Supabase (migração 0035).
 * Assim o editor, os cálculos e as "Outras sugestões" são os mesmos, sem
 * cópia, e nada do paciente passa pelo IndexedDB da profissional.
 *
 * Duas diferenças do repositório local, as duas por causa da rede:
 *
 * - **Gravações em fila.** O editor grava a cada mudança, sem esperar; pela
 *   rede, uma gravação antiga poderia chegar depois de uma nova e desfazê-la.
 *   Aqui só uma vai por vez, e a próxima leva sempre a versão mais nova.
 * - **Sem conflito por versão.** O rascunho é de uma pessoa só (a
 *   profissional), e o banco já recusa quem não tem vínculo ativo.
 *
 * Abrir sem rascunho começa da última versão publicada: editar um plano
 * publicado nunca mexe nele, cria um rascunho novo.
 */
const meals = z.array(mealSchema);

export function createPlanDraftDietRepository(
  client: ProSupabaseClient,
  plan: { readonly planId: string; readonly linkId: string },
): DietRepository & { readonly flush: () => Promise<void> } {
  let latest: Diet | null = null;
  let running: Promise<void> | null = null;

  async function write(diet: Diet): Promise<void> {
    const { error } = await client.rpc("save_plan_draft", {
      p_plan_id: plan.planId,
      p_link_id: plan.linkId,
      p_name: diet.name.trim() === "" ? "Plano alimentar" : diet.name,
      p_meals: diet.meals,
    });
    if (error !== null) throw new Error(error.message);
  }

  async function load(): Promise<Diet | undefined> {
    const draft = await client
      .from("prescribed_plan_drafts")
      .select("name,meals,updated_at")
      .eq("plan_id", plan.planId);
    if (draft.error !== null) throw new Error(draft.error.message);
    const [row] = z
      .array(z.object({ name: z.string(), meals: z.unknown(), updated_at: z.string() }))
      .parse(draft.data);
    if (row !== undefined) return toDiet(row.name, row.meals, Date.parse(row.updated_at));

    const versions = await client
      .from("prescribed_plan_versions")
      .select("name,meals,version,published_at")
      .eq("plan_id", plan.planId);
    if (versions.error !== null) throw new Error(versions.error.message);
    const published = z
      .array(z.object({ name: z.string(), meals: z.unknown(), version: z.number(), published_at: z.string() }))
      .parse(versions.data)
      .sort((a, b) => b.version - a.version)[0];
    if (published !== undefined) return toDiet(published.name, published.meals, Date.parse(published.published_at));
    return undefined;
  }

  function toDiet(name: string, raw: unknown, updatedAt: number): Diet {
    return { id: plan.planId, name, meals: meals.parse(raw), weekdays: [], createdAt: updatedAt, updatedAt };
  }

  return {
    async listAll() {
      const diet = latest ?? (await load());
      return diet === undefined ? [] : [diet];
    },
    async getById(id) {
      if (id !== plan.planId) return undefined;
      return latest ?? (await load());
    },
    save(diet) {
      latest = diet;
      if (running === null) {
        running = (async () => {
          let next = latest;
          let sent: Diet | null = null;
          while (next !== null && next !== sent) {
            sent = next;
            await write(next);
            next = latest;
          }
        })().finally(() => {
          running = null;
        });
      }
      return running;
    },
    remove() {
      return Promise.reject(new Error("Um plano não se apaga pelo editor."));
    },
    /** Espera a última mudança chegar ao banco: publicar lê o rascunho de lá. */
    flush() {
      return running ?? Promise.resolve();
    },
  };
}
