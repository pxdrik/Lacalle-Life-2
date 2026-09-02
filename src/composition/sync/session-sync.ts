import { sessionExercisesPayloadSchema } from "@/composition/backup-schemas";
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
import type { Session } from "@/features/workouts/types/session";
import type { SessionRepository } from "@/features/workouts/data/session-repository";

import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "sessions";

/**
 * Mesmo desenho de `diet-sync.ts`/`routine-sync.ts` — muitos registros por
 * usuário, família "visível, documento inteiro" — com uma regra a mais que
 * não existe em nenhuma das outras duas: **uma sessão só entra nesta fila
 * quando `finishedAt !== null`** (docs/arquitetura-sincronizacao.md §8.4).
 * Um treino em andamento não tem por que existir em dois aparelhos ao mesmo
 * tempo, então nem tenta — `SyncingSessionRepository` (a única porta de
 * entrada real) simplesmente nunca marca pendente uma sessão em andamento.
 * O `if (session.finishedAt === null) continue` em `pushOneSession` abaixo é
 * defesa em profundidade, não o mecanismo principal — o servidor também
 * recusa (`save_workout_session` levanta exceção), então mesmo um bug que
 * fizesse essa checagem falhar aqui não conseguiria empurrar uma sessão em
 * andamento por engano.
 *
 * A tabela remota é `workout_sessions`, não `sessions` (esse é só o nome da
 * store local) — e ao contrário de `Diet`/`Routine`, nem tudo mora dentro de
 * `payload`: `routine_id`/`name`/`started_at`/`finished_at` são colunas
 * próprias (migration 0002/0026), só `exercises` vai no jsonb. Ver
 * `sessionExercisesPayloadSchema` em `backup-schemas.ts`.
 */
export interface SessionConflict {
  readonly sessionId: string;
  readonly local: Session | null;
  readonly remote: Session | null;
}

export type PushSessionsResult =
  | { readonly status: "nothing-pending" }
  | { readonly status: "not-authenticated" }
  | {
      readonly status: "done";
      readonly pushed: readonly string[];
      readonly conflicts: readonly string[];
      readonly errors: readonly { readonly sessionId: string; readonly message: string }[];
    };

/**
 * Envia toda sessão pendente (`listPending(tracker, "sessions")`) — só
 * chega aqui uma sessão com `finishedAt !== null`, pela disciplina de
 * `SyncingSessionRepository`. Mesmo desenho de `pushAllRoutines`: uma RPC
 * por registro, nunca resolve conflito sozinha.
 */
export async function pushAllSessions(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: SessionRepository,
): Promise<PushSessionsResult> {
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
  const errors: { sessionId: string; message: string }[] = [];

  for (const entry of pending) {
    const outcome = await pushOneSession(client, tracker, localOnly, entry.recordId);
    if (outcome === "skip") continue;
    if (outcome.status === "pushed") pushed.push(entry.recordId);
    else if (outcome.status === "conflict") conflicts.push(entry.recordId);
    else if (outcome.status === "error") errors.push({ sessionId: entry.recordId, message: outcome.message });
  }

  return { status: "done", pushed, conflicts, errors };
}

async function pushOneSession(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: SessionRepository,
  sessionId: string,
): Promise<{ status: "pushed" | "conflict" } | { status: "error"; message: string } | "skip"> {
  const entry = await tracker.get(trackerId(STORE_NAME, sessionId));
  const session = await localOnly.getById(sessionId);
  const expected = getExpectedServerUpdatedAt(entry);

  if (session === undefined) {
    if (expected === null) {
      await markClean(tracker, STORE_NAME, sessionId, null);
      return { status: "pushed" };
    }

    const { data, error } = await client.rpc<{
      server_updated_at: string;
      applied: boolean;
    }>("delete_workout_session", { p_id: sessionId, p_expected_server_updated_at: expected });

    if (error !== null) return { status: "error", message: error.message };
    const result = data?.[0];
    if (result === undefined) return { status: "error", message: "empty response" };

    if (result.applied) {
      await markClean(tracker, STORE_NAME, sessionId, result.server_updated_at);
      return { status: "pushed" };
    }

    await markConflict(tracker, STORE_NAME, sessionId, result.server_updated_at);
    return { status: "conflict" };
  }

  // Defesa em profundidade — ver a doc no topo do arquivo. Não deveria
  // conseguir chegar aqui, mas se chegasse, `save_workout_session` recusaria
  // de qualquer jeito; pular em silêncio evita gastar uma chamada de rede
  // fadada a falhar.
  if (session.finishedAt === null) return "skip";

  const { data, error } = await client.rpc<{
    server_updated_at: string;
    applied: boolean;
  }>("save_workout_session", {
    p_id: sessionId,
    p_routine_id: session.routineId,
    p_name: session.name,
    p_started_at: session.startedAt,
    p_finished_at: session.finishedAt,
    p_payload: { exercises: session.exercises },
    p_client_updated_at: session.updatedAt,
    p_expected_server_updated_at: expected,
  });

  if (error !== null) return { status: "error", message: error.message };
  const result = data?.[0];
  if (result === undefined) return { status: "error", message: "empty response" };

  if (result.applied) {
    await markClean(tracker, STORE_NAME, sessionId, result.server_updated_at);
    return { status: "pushed" };
  }

  await markConflict(tracker, STORE_NAME, sessionId, result.server_updated_at);
  return { status: "conflict" };
}

export type PullSessionsResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "done";
      readonly conflicts: readonly SessionConflict[];
      /** Ids cujo `payload` não passou no schema — puladas, não travam as demais. */
      readonly invalid: readonly string[];
    };

interface RemoteSessionRow {
  readonly id: string;
  readonly routine_id: string | null;
  readonly name: string;
  readonly started_at: number;
  readonly finished_at: number | null;
  readonly payload: unknown;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Traz toda linha de `workout_sessions` do usuário numa query só — mesmo
 * motivo de `pullAllRoutines`. Mesma ordem de decisão por linha; ver a doc
 * de `pullAllDiets` em `diet-sync.ts` para o raciocínio completo por trás
 * de cada ramo.
 */
export async function pullAllSessions(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: SessionRepository,
): Promise<PullSessionsResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) {
    return { status: "not-authenticated" };
  }

  const { data, error } = await client
    .from("workout_sessions")
    .select("id,routine_id,name,started_at,finished_at,payload,client_updated_at,server_updated_at,deleted_at")
    .eq("user_id", uid);

  if (error !== null) return { status: "error", message: error.message };
  const rows = (data ?? []) as unknown as readonly RemoteSessionRow[];

  const conflicts: SessionConflict[] = [];
  const invalid: string[] = [];

  for (const row of rows) {
    const entry = await tracker.get(trackerId(STORE_NAME, row.id));
    const currentLocal = await localOnly.getById(row.id);

    if (row.deleted_at !== null) {
      // Mesmo achado de `pullAllDiets`/`pullAllRoutines`: só é conflito de
      // verdade quando ainda existe uma edição local em jogo.
      if ((entry?.status === "pending" || entry?.status === "conflict") && currentLocal !== undefined) {
        await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
        conflicts.push({ sessionId: row.id, local: currentLocal, remote: null });
        continue;
      }

      if (currentLocal !== undefined) {
        await localOnly.remove(row.id);
      }
      await markClean(tracker, STORE_NAME, row.id, row.server_updated_at);
      continue;
    }

    const parsed = sessionExercisesPayloadSchema.safeParse(row.payload);
    if (!parsed.success) {
      invalid.push(row.id);
      continue;
    }

    const remote: Session = {
      id: row.id,
      routineId: row.routine_id,
      name: row.name,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      // `durationSeconds` é `.nullable().optional()` no schema — mesmo
      // motivo de `routine-sync.ts`: um set gravado antes do campo existir
      // não tem a chave. Normalizado aqui do mesmo jeito que
      // `LocalSessionRepository.normalize()` já faz na leitura local.
      exercises: parsed.data.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({
          ...set,
          durationSeconds: set.durationSeconds ?? null,
          planned:
            set.planned === null
              ? null
              : { ...set.planned, durationSeconds: set.planned.durationSeconds ?? null },
        })),
      })),
      createdAt: currentLocal?.createdAt ?? row.client_updated_at,
      updatedAt: row.client_updated_at,
    };

    if (entry?.status === "conflict") {
      await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
      conflicts.push({ sessionId: row.id, local: currentLocal ?? null, remote });
      continue;
    }

    if (entry?.status === "pending") {
      if (entry.serverUpdatedAt !== row.server_updated_at) {
        await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
        conflicts.push({ sessionId: row.id, local: currentLocal ?? null, remote });
        continue;
      }
      continue;
    }

    await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    await markClean(tracker, STORE_NAME, row.id, row.server_updated_at);
  }

  return { status: "done", conflicts, invalid };
}

export type SessionConflictResolution = "keep-local" | "use-server";

/**
 * Resolve um conflito de uma sessão. Mesma mecânica de
 * `resolveRoutineConflict` — "manter local" nunca sobrescreve nada aqui,
 * "usar servidor" aplica exatamente o `remote` que `pullAllSessions`
 * devolveu (`null` remove local).
 */
export async function resolveSessionConflict(
  tracker: Store<SyncTracker>,
  localOnly: SessionRepository,
  sessionId: string,
  resolution: SessionConflictResolution,
  remote: Session | null,
): Promise<void> {
  if (resolution === "use-server") {
    const entry = await tracker.get(trackerId(STORE_NAME, sessionId));
    const serverUpdatedAt = getExpectedServerUpdatedAt(entry);
    const currentLocal = await localOnly.getById(sessionId);

    if (remote === null) {
      if (currentLocal !== undefined) await localOnly.remove(sessionId);
    } else {
      await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    }

    await markClean(tracker, STORE_NAME, sessionId, serverUpdatedAt);
    return;
  }

  await forcePendingAfterResolution(tracker, STORE_NAME, sessionId);
}
