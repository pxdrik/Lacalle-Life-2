import type { Store } from "@/core/storage/store";
import {
  forcePendingAfterResolution,
  getExpectedServerUpdatedAt,
  listPending,
  markClean,
  markConflict,
  markPendingWithSnapshot,
  trackerId,
  type SyncTracker,
} from "@/core/sync/sync-tracker";
import type { WaterRepository } from "@/features/hydration/data/water-repository";
import type { WaterEntry } from "@/features/hydration/types/water-entry";

import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "waterEntries";

/**
 * Mesmo desenho de `body-entry-sync.ts`: `WaterEntry` é a mesma família
 * "visível, documento inteiro" que `BodyEntry` — um total de água registrado
 * é uma decisão do dia, sem substrutura que valha a pena mesclar campo a
 * campo, então dois dispositivos discordando do total de hoje é um conflito
 * de verdade. `save_water_entry`/`delete_water_entry` seguem a mesma forma
 * de `save_body_entry`/`delete_body_entry` (RPC por dia, `(server_updated_at,
 * applied)`), só com um campo escalar (`p_ml`) em vez de quatro.
 */
export interface WaterEntryConflict {
  readonly day: string;
  readonly local: WaterEntry | null;
  readonly remote: WaterEntry | null;
}

function waterEntriesEqual(a: WaterEntry, b: WaterEntry): boolean {
  return a.ml === b.ml;
}

export type PushWaterEntriesResult =
  | { readonly status: "nothing-pending" }
  | { readonly status: "not-authenticated" }
  | {
      readonly status: "done";
      readonly pushed: readonly string[];
      readonly conflicts: readonly string[];
      readonly errors: readonly { readonly day: string; readonly message: string }[];
    };

/**
 * Envia todo registro pendente, uma RPC por dia. Nunca tenta resolver um
 * conflito sozinha — um dia já em `"conflict"` nem entra na lista.
 */
export async function pushAllWaterEntries(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: WaterRepository,
): Promise<PushWaterEntriesResult> {
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
    const outcome = await pushOneWaterEntry(client, tracker, localOnly, entry.recordId);
    if (outcome.status === "pushed") pushed.push(entry.recordId);
    else if (outcome.status === "conflict") conflicts.push(entry.recordId);
    else if (outcome.status === "error") errors.push({ day: entry.recordId, message: outcome.message });
  }

  return { status: "done", pushed, conflicts, errors };
}

async function pushOneWaterEntry(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: WaterRepository,
  day: string,
): Promise<{ status: "pushed" | "conflict" } | { status: "error"; message: string }> {
  const entry = await tracker.get(trackerId(STORE_NAME, day));
  const waterEntry = await localOnly.getByDay(day);
  const expected = getExpectedServerUpdatedAt(entry);

  if (waterEntry === undefined) {
    if (expected === null) {
      await markClean(tracker, STORE_NAME, day, null);
      return { status: "pushed" };
    }

    const { data, error } = await client.rpc<{
      server_updated_at: string;
      applied: boolean;
    }>("delete_water_entry", { p_day: day, p_expected_server_updated_at: expected });

    if (error !== null) return { status: "error", message: error.message };
    const result = data?.[0];
    if (result === undefined) return { status: "error", message: "empty response" };

    if (result.applied) {
      await markClean(tracker, STORE_NAME, day, result.server_updated_at);
      return { status: "pushed" };
    }

    await markConflict(tracker, STORE_NAME, day, result.server_updated_at);
    return { status: "conflict" };
  }

  const { data, error } = await client.rpc<{
    server_updated_at: string;
    applied: boolean;
  }>("save_water_entry", {
    p_day: day,
    p_ml: waterEntry.ml,
    p_client_updated_at: waterEntry.updatedAt,
    p_expected_server_updated_at: expected,
  });

  if (error !== null) return { status: "error", message: error.message };
  const result = data?.[0];
  if (result === undefined) return { status: "error", message: "empty response" };

  if (result.applied) {
    await markClean(tracker, STORE_NAME, day, result.server_updated_at);
    return { status: "pushed" };
  }

  await markConflict(tracker, STORE_NAME, day, result.server_updated_at);
  return { status: "conflict" };
}

export type PullWaterEntriesResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "done";
      readonly conflicts: readonly WaterEntryConflict[];
    };

interface RemoteWaterEntryRow {
  readonly day: string;
  readonly ml: number;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Traz toda linha de `water_entries` do usuário numa query só — mesmo
 * motivo de `pullAllBodyEntries`: achar um dia novo registrado em outro
 * dispositivo. Mesma ordem de decisão por linha, ver a doc completa em
 * `body-entry-sync.ts`.
 */
export async function pullAllWaterEntries(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: WaterRepository,
): Promise<PullWaterEntriesResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) {
    return { status: "not-authenticated" };
  }

  const { data, error } = await client
    .from("water_entries")
    .select("day,ml,client_updated_at,server_updated_at,deleted_at")
    .eq("user_id", uid);

  if (error !== null) return { status: "error", message: error.message };
  const rows = (data ?? []) as unknown as readonly RemoteWaterEntryRow[];

  const conflicts: WaterEntryConflict[] = [];

  for (const row of rows) {
    const entry = await tracker.get(trackerId(STORE_NAME, row.day));
    const currentLocal = await localOnly.getByDay(row.day);

    if (row.deleted_at !== null) {
      if ((entry?.status === "pending" || entry?.status === "conflict") && currentLocal !== undefined) {
        await markConflict(tracker, STORE_NAME, row.day, row.server_updated_at);
        conflicts.push({ day: row.day, local: currentLocal, remote: null });
        continue;
      }

      if (currentLocal !== undefined) {
        await localOnly.remove(row.day);
      }
      await markClean(tracker, STORE_NAME, row.day, row.server_updated_at);
      continue;
    }

    const remote: WaterEntry = {
      id: row.day,
      day: row.day,
      ml: row.ml,
      createdAt: currentLocal?.createdAt ?? row.client_updated_at,
      updatedAt: row.client_updated_at,
    };

    if (
      entry?.status === "conflict" ||
      (entry?.status === "pending" && entry.serverUpdatedAt !== row.server_updated_at)
    ) {
      if (currentLocal !== undefined && waterEntriesEqual(currentLocal, remote)) {
        await localOnly.save(remote, currentLocal.updatedAt);
        await markClean(tracker, STORE_NAME, row.day, row.server_updated_at);
        continue;
      }

      // "Mais recente vence" automático por `updatedAt` — mesma decisão de
      // `pullAllBodyEntries`.
      if (currentLocal !== undefined && currentLocal.updatedAt >= remote.updatedAt) {
        await markPendingWithSnapshot(
          tracker,
          STORE_NAME,
          row.day,
          row.server_updated_at,
          undefined,
        );
        continue;
      }

      if (currentLocal !== undefined) {
        await localOnly.save(remote, currentLocal.updatedAt);
        await markClean(tracker, STORE_NAME, row.day, row.server_updated_at);
        continue;
      }

      await markConflict(tracker, STORE_NAME, row.day, row.server_updated_at);
      conflicts.push({ day: row.day, local: currentLocal ?? null, remote });
      continue;
    }

    if (entry?.status === "pending") {
      continue;
    }

    await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    await markClean(tracker, STORE_NAME, row.day, row.server_updated_at);
  }

  return { status: "done", conflicts };
}

export type WaterEntryConflictResolution = "keep-local" | "use-server";

/**
 * Resolve o conflito de um dia — mesma mecânica de `resolveBodyEntryConflict`.
 */
export async function resolveWaterEntryConflict(
  tracker: Store<SyncTracker>,
  localOnly: WaterRepository,
  day: string,
  resolution: WaterEntryConflictResolution,
  remote: WaterEntry | null,
): Promise<void> {
  if (resolution === "use-server") {
    const entry = await tracker.get(trackerId(STORE_NAME, day));
    const serverUpdatedAt = getExpectedServerUpdatedAt(entry);
    const currentLocal = await localOnly.getByDay(day);

    if (remote === null) {
      if (currentLocal !== undefined) await localOnly.remove(day);
    } else {
      await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    }

    await markClean(tracker, STORE_NAME, day, serverUpdatedAt);
    return;
  }

  await forcePendingAfterResolution(tracker, STORE_NAME, day);
}
