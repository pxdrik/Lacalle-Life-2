import { z } from "zod";

import type { DietRepository } from "@/features/diet/data/diet-repository";
import { WEEKDAYS } from "@/features/diet/services/diet-schedule";
import type { Diet, Weekday } from "@/features/diet/types/diet";
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
// Os dias são da profissional e viajam com o rascunho e a versão (0036).
const weekdays = z.array(z.enum(WEEKDAYS as [Weekday, ...Weekday[]]));

export function createPlanDraftDietRepository(
  client: ProSupabaseClient,
  plan: { readonly planId: string; readonly linkId: string },
): QueuedDietRepository {
  async function write(diet: Diet): Promise<void> {
    const { error } = await client.rpc("save_plan_draft", {
      p_plan_id: plan.planId,
      p_link_id: plan.linkId,
      p_name: diet.name.trim() === "" ? "Plano alimentar" : diet.name,
      p_meals: diet.meals,
      p_weekdays: diet.weekdays,
    });
    if (error !== null) throw new Error(error.message);
  }

  async function load(): Promise<Diet | undefined> {
    const draft = await client
      .from("prescribed_plan_drafts")
      .select("name,meals,weekdays,updated_at")
      .eq("plan_id", plan.planId);
    if (draft.error !== null) throw new Error(draft.error.message);
    const [row] = z
      .array(z.object({ name: z.string(), meals: z.unknown(), weekdays, updated_at: z.string() }))
      .parse(draft.data);
    if (row !== undefined) return toDiet(row.name, row.meals, row.weekdays, Date.parse(row.updated_at));

    const versions = await client
      .from("prescribed_plan_versions")
      .select("name,meals,weekdays,version,published_at")
      .eq("plan_id", plan.planId);
    if (versions.error !== null) throw new Error(versions.error.message);
    const published = z
      .array(
        z.object({ name: z.string(), meals: z.unknown(), weekdays, version: z.number(), published_at: z.string() }),
      )
      .parse(versions.data)
      .sort((a, b) => b.version - a.version)[0];
    if (published !== undefined) {
      return toDiet(published.name, published.meals, published.weekdays, Date.parse(published.published_at));
    }
    return undefined;
  }

  function toDiet(name: string, raw: unknown, days: Weekday[], updatedAt: number): Diet {
    return { id: plan.planId, name, meals: meals.parse(raw), weekdays: days, createdAt: updatedAt, updatedAt };
  }

  return queuedRepository<Diet>(plan.planId, load, write, "Um plano não se apaga pelo editor.");
}

/**
 * Um modelo da Biblioteca (Etapa 5d) no editor de dieta do app, pelo mesmo
 * caminho do plano: a "dieta" é a linha de `plan_templates`, gravada por
 * `save_plan_template` em fila. Sem dias: os dias são de cada plano, e
 * ficam com o padrão do plano quando o modelo é usado num paciente.
 */
export function createTemplateDraftDietRepository(client: ProSupabaseClient, templateId: string): QueuedDietRepository {
  async function write(diet: Diet): Promise<void> {
    const { error } = await client.rpc("save_plan_template", {
      p_template_id: templateId,
      p_name: diet.name.trim() === "" ? "Modelo" : diet.name,
      p_meals: diet.meals,
    });
    if (error !== null) throw new Error(error.message);
  }

  async function load(): Promise<Diet | undefined> {
    const { data, error } = await client.from("plan_templates").select("name,meals,updated_at").eq("id", templateId);
    if (error !== null) throw new Error(error.message);
    const [row] = z.array(z.object({ name: z.string(), meals, updated_at: z.string() })).parse(data);
    if (row === undefined) return undefined;
    const updatedAt = Date.parse(row.updated_at);
    return { id: templateId, name: row.name, meals: row.meals, weekdays: [], createdAt: updatedAt, updatedAt };
  }

  return queuedRepository<Diet>(templateId, load, write, "Um modelo se apaga pela Biblioteca.");
}

export type QueuedDietRepository = DietRepository & { readonly flush: () => Promise<void> };

/**
 * Um registro só, lido da rede e gravado em fila (ver o comentário do topo):
 * o rascunho do plano, o modelo de plano e o modelo de treino da Biblioteca.
 */
export interface QueuedRepository<T> {
  listAll(): Promise<readonly T[]>;
  getById(id: string): Promise<T | undefined>;
  save(entity: T): Promise<void>;
  remove(id: string): Promise<void>;
  /** Espera a última mudança chegar ao banco: publicar e listar leem de lá. */
  flush(): Promise<void>;
}

export function queuedRepository<T>(
  id: string,
  load: () => Promise<T | undefined>,
  write: (entity: T) => Promise<void>,
  removeMessage: string,
): QueuedRepository<T> {
  let latest: T | null = null;
  let running: Promise<void> | null = null;

  return {
    async listAll() {
      const entity = latest ?? (await load());
      return entity === undefined ? [] : [entity];
    },
    async getById(requested) {
      if (requested !== id) return undefined;
      return latest ?? (await load());
    },
    save(entity) {
      latest = entity;
      if (running === null) {
        running = (async () => {
          let next = latest;
          let sent: T | null = null;
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
      return Promise.reject(new Error(removeMessage));
    },
    flush() {
      return running ?? Promise.resolve();
    },
  };
}
