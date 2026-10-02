import { z } from "zod";

import { WEEKDAYS, type Weekday } from "@/core/domain/weekday";
import type { LocalPrescribedRoutineRepository } from "@/features/workouts/data/prescribed-routine-repository";
import type { PrescribedRoutine } from "@/features/workouts/types/prescribed-routine";

import { routinePayloadSchema } from "../backup-schemas";
import type { SyncSupabaseClient } from "./sync-supabase-client";

export type PullPrescribedRoutinesResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "done" };

const routineRow = z.object({ id: z.string(), link_id: z.string(), created_at: z.string() });
const versionRow = z.object({
  version: z.number(),
  name: z.string(),
  notes: z.string(),
  exercises: z.unknown(),
  change_note: z.string(),
  published_at: z.string(),
  weekdays: z.array(z.enum(WEEKDAYS as [Weekday, ...Weekday[]])),
});
const linkRow = z.object({ link_id: z.string(), professional_name: z.string(), status: z.string() });
// O mesmo `?? null` de `routine-sync.ts`: `durationSeconds` é opcional no
// schema, e no app é sempre número ou `null`.
const exercises = routinePayloadSchema.shape.exercises.transform((items) =>
  items.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set, durationSeconds: set.durationSeconds ?? null })),
  })),
);

/**
 * Os treinos que o treinador publicou para esta conta (0038). O mesmo caminho
 * de `pullPrescribedPlans`: só desce, o servidor é a verdade e a coleção local
 * é trocada inteira.
 *
 * - Filtro explícito por `patient_id`: o treinador que também usa o app lê os
 *   treinos que ele montou, e eles não são dele para seguir.
 * - Treino sem versão publicada não desce.
 * - Versão que não valida não derruba as outras: o treino fica de fora até o
 *   app se atualizar.
 */
export async function pullPrescribedRoutines(
  client: SyncSupabaseClient,
  local: LocalPrescribedRoutineRepository,
): Promise<PullPrescribedRoutinesResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) return { status: "not-authenticated" };

  const [routines, links] = await Promise.all([
    client.from("prescribed_routines").select("id,link_id,created_at").eq("patient_id", uid),
    client.rpc("my_care_links", {}),
  ]);
  if (routines.error !== null) return { status: "error", message: routines.error.message };
  if (links.error !== null) return { status: "error", message: links.error.message };

  const linkById = new Map(z.array(linkRow).parse(links.data ?? []).map((link) => [link.link_id, link]));
  const received: Omit<PrescribedRoutine, "seenVersion">[] = [];

  for (const routine of z.array(routineRow).parse(routines.data ?? [])) {
    const versions = await client
      .from("prescribed_routine_versions")
      .select("version,name,notes,exercises,change_note,published_at,weekdays")
      .eq("routine_id", routine.id);
    if (versions.error !== null) return { status: "error", message: versions.error.message };

    const [latest, previous] = z
      .array(versionRow)
      .parse(versions.data ?? [])
      .sort((a, b) => b.version - a.version);
    if (latest === undefined) continue;
    const latestExercises = exercises.safeParse(latest.exercises);
    if (!latestExercises.success) continue;
    const previousExercises = previous === undefined ? null : exercises.safeParse(previous.exercises);

    const link = linkById.get(routine.link_id);
    received.push({
      id: routine.id,
      name: latest.name,
      notes: latest.notes,
      professionalName: link?.professional_name ?? "Seu treinador",
      version: latest.version,
      changeNote: latest.change_note,
      publishedAt: latest.published_at,
      exercises: latestExercises.data,
      previous:
        previous !== undefined && previousExercises?.success === true
          ? { version: previous.version, exercises: previousExercises.data, weekdays: previous.weekdays }
          : null,
      weekdays: latest.weekdays,
      linkEnded: link?.status !== "active",
      createdAt: Date.parse(routine.created_at),
      updatedAt: Date.parse(latest.published_at),
    });
  }

  await local.replaceAll(received);
  return { status: "done" };
}
