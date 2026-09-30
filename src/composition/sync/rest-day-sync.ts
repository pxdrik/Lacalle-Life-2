import type { Store } from "@/core/storage/store";
import {
  getExpectedServerUpdatedAt,
  listPending,
  markClean,
  markConflict,
  trackerId,
  type SyncTracker,
} from "@/core/sync/sync-tracker";
import type { RestDayRepository } from "@/features/workouts/data/rest-day-repository";

import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "restDays";

/**
 * Sync do dia de descanso (roadmap 7.5) — o push é o de `water-entry-sync.ts`
 * (RPC por dia, `(server_updated_at, applied)`), sem nenhum campo além do dia.
 *
 * **O conflito se resolve sozinho, e o servidor vence.** As outras famílias
 * bloqueiam até alguém escolher numa tela de conflito, e o descanso não tem
 * essa tela (a água também não, e um conflito dela fica travado para sempre).
 * Aqui só existe uma divergência possível — marcado num aparelho, desmarcado
 * no outro — e o que está em jogo é um toque para marcar de novo. Então:
 * iguais, fica limpo; diferentes, o pull aplica o servidor. Nada fica em
 * `"conflict"` depois de um ciclo push + pull.
 */
export type PushRestDaysResult =
  | { readonly status: "nothing-pending" }
  | { readonly status: "not-authenticated" }
  | {
      readonly status: "done";
      readonly pushed: readonly string[];
      readonly conflicts: readonly string[];
      readonly errors: readonly { readonly day: string; readonly message: string }[];
    };

export async function pushAllRestDays(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: RestDayRepository,
): Promise<PushRestDaysResult> {
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
  const errors: { day: string; message: string }[] = [];

  for (const entry of pending) {
    const outcome = await pushOneRestDay(client, tracker, localOnly, entry.recordId);
    if (outcome.status === "pushed") pushed.push(entry.recordId);
    else if (outcome.status === "conflict") conflicts.push(entry.recordId);
    else if (outcome.status === "error") errors.push({ day: entry.recordId, message: outcome.message });
  }

  return { status: "done", pushed, conflicts, errors };
}

async function pushOneRestDay(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: RestDayRepository,
  day: string,
): Promise<{ status: "pushed" | "conflict" } | { status: "error"; message: string }> {
  const expected = getExpectedServerUpdatedAt(await tracker.get(trackerId(STORE_NAME, day)));
  const restDay = await localOnly.getByDay(day);

  if (restDay === undefined && expected === null) {
    // Marcado e desmarcado antes de subir: o servidor nunca soube.
    await markClean(tracker, STORE_NAME, day, null);
    return { status: "pushed" };
  }

  const { data, error } =
    restDay === undefined
      ? await client.rpc<{ server_updated_at: string; applied: boolean }>("delete_rest_day", {
          p_day: day,
          p_expected_server_updated_at: expected,
        })
      : await client.rpc<{ server_updated_at: string; applied: boolean }>("save_rest_day", {
          p_day: day,
          p_client_updated_at: restDay.updatedAt,
          p_expected_server_updated_at: expected,
        });

  if (error !== null) return { status: "error", message: error.message };
  const result = data?.[0];
  if (result === undefined) return { status: "error", message: "empty response" };

  if (result.applied) {
    await markClean(tracker, STORE_NAME, day, result.server_updated_at);
    return { status: "pushed" };
  }

  // Fica em "conflict" só até o pull deste mesmo ciclo — ver a doc do topo.
  await markConflict(tracker, STORE_NAME, day, result.server_updated_at);
  return { status: "conflict" };
}

export type PullRestDaysResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "done" };

interface RemoteRestDayRow {
  readonly day: string;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Traz toda linha de `rest_days` do usuário. Por linha:
 *
 * - pendente local sobre a mesma versão do servidor: espera o push;
 * - servidor e aparelho concordam (os dois marcados, ou os dois não): limpo;
 * - discordam: vale o servidor.
 */
export async function pullAllRestDays(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: RestDayRepository,
): Promise<PullRestDaysResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) {
    return { status: "not-authenticated" };
  }

  const { data, error } = await client
    .from("rest_days")
    .select("day,client_updated_at,server_updated_at,deleted_at")
    .eq("user_id", uid);

  if (error !== null) return { status: "error", message: error.message };
  const rows = (data ?? []) as unknown as readonly RemoteRestDayRow[];

  for (const row of rows) {
    const entry = await tracker.get(trackerId(STORE_NAME, row.day));
    const local = await localOnly.getByDay(row.day);

    if (entry?.status === "pending" && entry.serverUpdatedAt === row.server_updated_at) {
      continue;
    }

    if (row.deleted_at !== null) {
      if (local !== undefined) await localOnly.remove(row.day);
    } else if (local === undefined) {
      await localOnly.save(
        {
          id: row.day,
          day: row.day,
          createdAt: row.client_updated_at,
          updatedAt: row.client_updated_at,
        },
        null,
      );
    }
    // Os dois marcados: o registro local fica como está.

    await markClean(tracker, STORE_NAME, row.day, row.server_updated_at);
  }

  return { status: "done" };
}
