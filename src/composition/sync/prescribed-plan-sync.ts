import { z } from "zod";

import type { LocalPrescribedPlanRepository } from "@/features/diet/data/prescribed-plan-repository";
import type { Weekday } from "@/features/diet/types/diet";
import type { PrescribedPlan } from "@/features/diet/types/prescribed-plan";
import { WEEKDAYS } from "@/features/diet/services/diet-schedule";

import { mealSchema } from "../backup-schemas";
import type { SyncSupabaseClient } from "./sync-supabase-client";

export type PullPrescribedPlansResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "done" };

const planRow = z.object({ id: z.string(), link_id: z.string(), name: z.string(), created_at: z.string() });
const versionRow = z.object({
  version: z.number(),
  name: z.string(),
  meals: z.unknown(),
  change_note: z.string(),
  published_at: z.string(),
  // Os dias são da profissional e moram na versão (0036).
  weekdays: z.array(z.enum(WEEKDAYS as [Weekday, ...Weekday[]])),
});
const linkRow = z.object({ link_id: z.string(), professional_name: z.string(), status: z.string() });
const meals = z.array(mealSchema);

/**
 * Os planos que a nutricionista publicou para esta conta (0035). Só desce:
 * o paciente não escreve plano, então não há push, rastreador nem conflito.
 * O servidor é a verdade e a coleção local é trocada inteira.
 *
 * - Filtro explícito por `patient_id`, como toda leitura da sincronização: a
 *   profissional que também usa o app lê os planos que ela mesma montou, e
 *   eles não são dela para seguir.
 * - Plano sem versão publicada não desce: a linha existe desde o primeiro
 *   rascunho, mas o paciente só vê o que foi publicado.
 * - Versão que não valida (formato que esta versão do app não conhece) não
 *   derruba as outras: o plano fica de fora até o app se atualizar.
 */
export async function pullPrescribedPlans(
  client: SyncSupabaseClient,
  local: LocalPrescribedPlanRepository,
): Promise<PullPrescribedPlansResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) return { status: "not-authenticated" };

  const [plans, links] = await Promise.all([
    client.from("prescribed_plans").select("id,link_id,name,created_at").eq("patient_id", uid),
    client.rpc("my_care_links", {}),
  ]);
  if (plans.error !== null) return { status: "error", message: plans.error.message };
  if (links.error !== null) return { status: "error", message: links.error.message };

  const linkById = new Map(z.array(linkRow).parse(links.data ?? []).map((link) => [link.link_id, link]));
  const received: Omit<PrescribedPlan, "seenVersion">[] = [];

  for (const plan of z.array(planRow).parse(plans.data ?? [])) {
    const versions = await client
      .from("prescribed_plan_versions")
      .select("version,name,meals,change_note,published_at,weekdays")
      .eq("plan_id", plan.id);
    if (versions.error !== null) return { status: "error", message: versions.error.message };

    const [latest, previous] = z
      .array(versionRow)
      .parse(versions.data ?? [])
      .sort((a, b) => b.version - a.version);
    if (latest === undefined) continue;
    const latestMeals = meals.safeParse(latest.meals);
    if (!latestMeals.success) continue;
    const previousMeals = previous === undefined ? null : meals.safeParse(previous.meals);

    const link = linkById.get(plan.link_id);
    received.push({
      id: plan.id,
      name: latest.name,
      professionalName: link?.professional_name ?? "Sua nutricionista",
      version: latest.version,
      changeNote: latest.change_note,
      publishedAt: latest.published_at,
      meals: latestMeals.data,
      previous:
        previous !== undefined && previousMeals?.success === true
          ? { version: previous.version, meals: previousMeals.data, weekdays: previous.weekdays }
          : null,
      weekdays: latest.weekdays,
      linkEnded: link?.status !== "active",
      createdAt: Date.parse(plan.created_at),
      updatedAt: Date.parse(latest.published_at),
    });
  }

  await local.replaceAll(received);
  return { status: "done" };
}
