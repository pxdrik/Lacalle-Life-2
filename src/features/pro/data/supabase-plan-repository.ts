import { z } from "zod";

import type { PlanRepository } from "./plan-repository";
import type { ProSupabaseClient } from "./supabase-pro-repository";

const versionRow = z.object({
  version: z.number(),
  name: z.string(),
  change_note: z.string(),
  published_at: z.string(),
  meals: z.unknown(),
});

function fail(error: { readonly message: string } | null): void {
  if (error !== null) throw new Error(error.message);
}

export function createSupabasePlanRepository(client: ProSupabaseClient): PlanRepository {
  return {
    async listPlans(linkId) {
      const { data: userData } = await client.auth.getUser();
      if (userData.user === null) throw new Error("not authenticated");
      // Filtro explícito pela profissional, como em toda leitura: o paciente
      // também lê estes planos (0035), e quem lê aqui é a profissional.
      const plans = await client
        .from("prescribed_plans")
        .select("id,name,created_at")
        .eq("link_id", linkId)
        .eq("professional_id", userData.user.id);
      fail(plans.error);
      const rows = z
        .array(z.object({ id: z.string(), name: z.string(), created_at: z.string() }))
        .parse(plans.data)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      return Promise.all(
        rows.map(async (plan) => {
          const [draft, versions] = await Promise.all([
            client.from("prescribed_plan_drafts").select("plan_id").eq("plan_id", plan.id),
            client.from("prescribed_plan_versions").select("version,name,change_note,published_at,meals").eq("plan_id", plan.id),
          ]);
          fail(draft.error);
          fail(versions.error);
          return {
            id: plan.id,
            name: plan.name,
            hasDraft: z.array(z.unknown()).parse(draft.data).length > 0,
            versions: z
              .array(versionRow)
              .parse(versions.data)
              .sort((a, b) => b.version - a.version)
              .map((row) => ({
                version: row.version,
                name: row.name,
                changeNote: row.change_note,
                publishedAt: row.published_at,
                meals: row.meals,
              })),
          };
        }),
      );
    },

    async createPlan(linkId, name) {
      const { data, error } = await client.rpc("save_plan_draft", {
        p_plan_id: null,
        p_link_id: linkId,
        p_name: name,
        p_meals: [],
      });
      fail(error);
      return z.string().parse(data);
    },

    async publish(planId, changeNote) {
      const { data, error } = await client.rpc("publish_plan", { p_plan_id: planId, p_change_note: changeNote });
      fail(error);
      return z.number().parse(data);
    },
  };
}
