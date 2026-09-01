import { routinePayloadSchema } from "@/composition/backup-schemas";
import type { Store } from "@/core/storage/store";
import {
  getExpectedServerUpdatedAt,
  listPending,
  markClean,
  markConflict,
  forcePendingAfterResolution,
  trackerId,
  type SyncTracker,
} from "@/core/sync/sync-tracker";
import type { Routine } from "@/features/workouts/types/routine";
import type { RoutineRepository } from "@/features/workouts/data/routine-repository";

import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "routines";

/**
 * Mesmo desenho de `diet-sync.ts` — `Routine` é a segunda entidade com
 * muitos registros por usuário, e a forma do problema é idêntica: `Diet`
 * tem `{name, meals, weekdays}`, `Routine` tem `{name, notes, exercises}`,
 * as duas Entity-por-id, as duas na família "visível, documento inteiro"
 * (§17.1). `save_routine`/`delete_routine` (migration 0025) seguem o mesmo
 * par `applied`/`server_updated_at` que `save_diet`/`delete_diet` — nunca
 * passaram pela versão insegura que `diets` passou em 0023, mas o contrato
 * de retorno é o mesmo, então o motor abaixo é o mesmo motor, só trocando
 * de tabela e de payload.
 */
export interface RoutineConflict {
  readonly routineId: string;
  readonly local: Routine | null;
  readonly remote: Routine | null;
}

export type PushRoutinesResult =
  | { readonly status: "nothing-pending" }
  | { readonly status: "not-authenticated" }
  | {
      readonly status: "done";
      readonly pushed: readonly string[];
      readonly conflicts: readonly string[];
      readonly errors: readonly { readonly routineId: string; readonly message: string }[];
    };

/**
 * Envia toda rotina pendente (`listPending(tracker, "routines")`), uma RPC
 * por rotina. Nunca tenta resolver um conflito sozinha — uma rotina já em
 * `"conflict"` nem entra na lista (`listPending` só devolve `"pending"`).
 *
 * Uma rotina sem registro local é uma exclusão pendente: chama
 * `delete_routine` em vez de `save_routine`. Nunca existiu no servidor
 * (`expected === null`) é o caso trivial — nada para apagar lá, só volta a
 * `"clean"`, mesmo desenho do ramo `diet === undefined` de `pushOneDiet`.
 */
export async function pushAllRoutines(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: RoutineRepository,
): Promise<PushRoutinesResult> {
  const pending = await listPending(tracker, STORE_NAME);
  if (pending.length === 0) {
    return { status: "nothing-pending" };
  }

  const { data: userData } = await client.auth.getUser();
  if (userData.user === null) {
    return { status: "not-authenticated" };
  }

  const pushed: string[] = [];
  const conflicts: string[] = [];
  const errors: { routineId: string; message: string }[] = [];

  for (const entry of pending) {
    const outcome = await pushOneRoutine(client, tracker, localOnly, entry.recordId);
    if (outcome.status === "pushed") pushed.push(entry.recordId);
    else if (outcome.status === "conflict") conflicts.push(entry.recordId);
    else if (outcome.status === "error") errors.push({ routineId: entry.recordId, message: outcome.message });
  }

  return { status: "done", pushed, conflicts, errors };
}

async function pushOneRoutine(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: RoutineRepository,
  routineId: string,
): Promise<{ status: "pushed" | "conflict" } | { status: "error"; message: string }> {
  const entry = await tracker.get(trackerId(STORE_NAME, routineId));
  const routine = await localOnly.getById(routineId);
  const expected = getExpectedServerUpdatedAt(entry);

  if (routine === undefined) {
    if (expected === null) {
      await markClean(tracker, STORE_NAME, routineId, null);
      return { status: "pushed" };
    }

    const { data, error } = await client.rpc<{
      server_updated_at: string;
      applied: boolean;
    }>("delete_routine", { p_id: routineId, p_expected_server_updated_at: expected });

    if (error !== null) return { status: "error", message: error.message };
    const result = data?.[0];
    if (result === undefined) return { status: "error", message: "empty response" };

    if (result.applied) {
      await markClean(tracker, STORE_NAME, routineId, result.server_updated_at);
      return { status: "pushed" };
    }

    await markConflict(tracker, STORE_NAME, routineId, result.server_updated_at);
    return { status: "conflict" };
  }

  const { data, error } = await client.rpc<{
    server_updated_at: string;
    applied: boolean;
  }>("save_routine", {
    p_id: routineId,
    p_payload: { name: routine.name, notes: routine.notes, exercises: routine.exercises },
    p_client_updated_at: routine.updatedAt,
    p_expected_server_updated_at: expected,
  });

  if (error !== null) return { status: "error", message: error.message };
  const result = data?.[0];
  if (result === undefined) return { status: "error", message: "empty response" };

  if (result.applied) {
    await markClean(tracker, STORE_NAME, routineId, result.server_updated_at);
    return { status: "pushed" };
  }

  await markConflict(tracker, STORE_NAME, routineId, result.server_updated_at);
  return { status: "conflict" };
}

export type PullRoutinesResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "done";
      readonly conflicts: readonly RoutineConflict[];
      /** Ids cujo `payload` não passou no schema — puladas, não travam as demais. */
      readonly invalid: readonly string[];
    };

interface RemoteRoutineRow {
  readonly id: string;
  readonly payload: unknown;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Traz toda linha de `routines` do usuário numa query só — mesmo motivo de
 * `pullAllDiets`: achar rotina nova de outro dispositivo, que este não tem
 * como pedir por id. Mesma ordem de decisão por linha, ver a doc de
 * `pullAllDiets` em `diet-sync.ts` para o raciocínio completo.
 */
export async function pullAllRoutines(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: RoutineRepository,
): Promise<PullRoutinesResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) {
    return { status: "not-authenticated" };
  }

  const { data, error } = await client
    .from("routines")
    .select("id,payload,client_updated_at,server_updated_at,deleted_at")
    .eq("user_id", uid);

  if (error !== null) return { status: "error", message: error.message };
  const rows = (data ?? []) as unknown as readonly RemoteRoutineRow[];

  const conflicts: RoutineConflict[] = [];
  const invalid: string[] = [];

  for (const row of rows) {
    const entry = await tracker.get(trackerId(STORE_NAME, row.id));
    const currentLocal = await localOnly.getById(row.id);

    if (row.deleted_at !== null) {
      // Mesmo achado de `pullAllDiets` (campanha adversarial, cenário 11):
      // só é conflito de verdade quando ainda existe uma edição local em
      // jogo — não só por o tracker ter passado por `"conflict"` no meio
      // do caminho de uma corrida de exclusão que os dois lados já
      // concordam ter perdido/ganho.
      if ((entry?.status === "pending" || entry?.status === "conflict") && currentLocal !== undefined) {
        await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
        conflicts.push({ routineId: row.id, local: currentLocal, remote: null });
        continue;
      }

      if (currentLocal !== undefined) {
        await localOnly.remove(row.id);
      }
      await markClean(tracker, STORE_NAME, row.id, row.server_updated_at);
      continue;
    }

    const parsed = routinePayloadSchema.safeParse(row.payload);
    if (!parsed.success) {
      invalid.push(row.id);
      continue;
    }

    const remote: Routine = {
      id: row.id,
      name: parsed.data.name,
      notes: parsed.data.notes,
      // `durationSeconds` é `.nullable().optional()` no schema (mesmo motivo
      // de `plannedSetSchema` em backup-schemas.ts: um set gravado antes do
      // campo existir não tem a chave) — normalizado aqui do mesmo jeito que
      // `LocalRoutineRepository.normalize()` já faz na leitura local, para
      // `Routine.exercises[].sets[].durationSeconds` continuar sempre
      // `number | null`, nunca `undefined`.
      exercises: parsed.data.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({
          ...set,
          durationSeconds: set.durationSeconds ?? null,
        })),
      })),
      createdAt: currentLocal?.createdAt ?? row.client_updated_at,
      updatedAt: row.client_updated_at,
    };

    if (entry?.status === "conflict") {
      await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
      conflicts.push({ routineId: row.id, local: currentLocal ?? null, remote });
      continue;
    }

    if (entry?.status === "pending") {
      if (entry.serverUpdatedAt !== row.server_updated_at) {
        await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
        conflicts.push({ routineId: row.id, local: currentLocal ?? null, remote });
        continue;
      }
      continue;
    }

    await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    await markClean(tracker, STORE_NAME, row.id, row.server_updated_at);
  }

  return { status: "done", conflicts, invalid };
}

export type RoutineConflictResolution = "keep-local" | "use-server";

/**
 * Resolve um conflito de uma rotina. Mesma mecânica de `resolveDietConflict`
 * — "manter local" nunca sobrescreve nada aqui, "usar servidor" aplica
 * exatamente o `remote` que `pullAllRoutines` devolveu (`null` remove
 * local).
 */
export async function resolveRoutineConflict(
  tracker: Store<SyncTracker>,
  localOnly: RoutineRepository,
  routineId: string,
  resolution: RoutineConflictResolution,
  remote: Routine | null,
): Promise<void> {
  if (resolution === "use-server") {
    const entry = await tracker.get(trackerId(STORE_NAME, routineId));
    const serverUpdatedAt = getExpectedServerUpdatedAt(entry);
    const currentLocal = await localOnly.getById(routineId);

    if (remote === null) {
      if (currentLocal !== undefined) await localOnly.remove(routineId);
    } else {
      await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    }

    await markClean(tracker, STORE_NAME, routineId, serverUpdatedAt);
    return;
  }

  await forcePendingAfterResolution(tracker, STORE_NAME, routineId);
}
