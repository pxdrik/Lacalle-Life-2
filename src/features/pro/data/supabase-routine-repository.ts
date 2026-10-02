import { z } from "zod";

import { WEEKDAYS, type Weekday } from "@/core/domain/weekday";

import type { ProRoutineRepository } from "./routine-repository";
import type { ProSupabaseClient } from "./supabase-pro-repository";

const versionRow = z.object({
  version: z.number(),
  name: z.string(),
  change_note: z.string(),
  published_at: z.string(),
  weekdays: z.array(z.enum(WEEKDAYS as [Weekday, ...Weekday[]])),
});

function fail(error: { readonly message: string } | null): void {
  if (error !== null) throw new Error(error.message);
}

/** O mesmo desenho de `supabase-plan-repository.ts`, para as tabelas do treino. */
export function createSupabaseRoutineRepository(client: ProSupabaseClient): ProRoutineRepository {
  return {
    async listRoutines(linkId) {
      const { data: userData } = await client.auth.getUser();
      if (userData.user === null) throw new Error("not authenticated");
      // Filtro explícito pelo treinador: o paciente também lê estes treinos
      // (0038), e quem lê aqui é o treinador.
      const routines = await client
        .from("prescribed_routines")
        .select("id,name,created_at")
        .eq("link_id", linkId)
        .eq("professional_id", userData.user.id);
      fail(routines.error);
      const rows = z
        .array(z.object({ id: z.string(), name: z.string(), created_at: z.string() }))
        .parse(routines.data)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      return Promise.all(
        rows.map(async (routine) => {
          const [draft, versions] = await Promise.all([
            client.from("prescribed_routine_drafts").select("routine_id").eq("routine_id", routine.id),
            client
              .from("prescribed_routine_versions")
              .select("version,name,change_note,published_at,weekdays")
              .eq("routine_id", routine.id),
          ]);
          fail(draft.error);
          fail(versions.error);
          return {
            id: routine.id,
            name: routine.name,
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
                weekdays: row.weekdays,
              })),
          };
        }),
      );
    },

    async createRoutine(linkId, name) {
      const { data, error } = await client.rpc("save_routine_draft", {
        p_routine_id: null,
        p_link_id: linkId,
        p_name: name,
        p_notes: "",
        p_exercises: [],
      });
      fail(error);
      return z.string().parse(data);
    },

    async publish(routineId, changeNote) {
      const { data, error } = await client.rpc("publish_routine", { p_routine_id: routineId, p_change_note: changeNote });
      fail(error);
      return z.number().parse(data);
    },
  };
}
