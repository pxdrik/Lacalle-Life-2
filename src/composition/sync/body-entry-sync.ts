import { z } from "zod";

import { deepEqual } from "@/core/domain/deep-equal";
import { MEASUREMENT_SITES } from "@/features/body/taxonomy/measurement-sites";
import type { BodyEntry, Measurements } from "@/features/body/types/body-entry";
import type { BodyRepository } from "@/features/body/data/body-repository";
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

import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "bodyEntries";

/**
 * Mesmo desenho de `diet-sync.ts` — `BodyEntry` é a terceira entidade com
 * muitos registros por usuário (depois de `Diet`/`Routine`), família
 * "visível, documento inteiro" (§17.1): um peso registrado é uma decisão de
 * dois minutos em pé no banheiro, sem subestrutura que valha a pena mesclar
 * campo a campo — dois dispositivos discordando do peso de hoje é um
 * conflito de verdade, não algo pra reconciliar sozinho (ao contrário de
 * `FoodLog`, onde duas adições independentes no mesmo dia são o caso comum).
 *
 * A diferença real para `pushOneDiet`/`pushOneRoutine`: `save_body_entry`/
 * `delete_body_entry` (migration 0029) não recebem um `p_payload` único —
 * os campos escalares vão soltos (`p_weight_kg`, `p_body_fat_percent`,
 * `p_measurements`, `p_notes`), porque a tabela `body_entries` é chaveada
 * por `(user_id, day)`, sem coluna `payload` nenhuma. A identidade do
 * registro (`BodyEntry.id === BodyEntry.day`, já a mesma convenção de
 * `FoodLog`) cai de graça no tracker — só a construção dos argumentos da
 * RPC muda.
 */
export interface BodyEntryConflict {
  readonly day: string;
  readonly local: BodyEntry | null;
  readonly remote: BodyEntry | null;
}

/**
 * Duas medições do mesmo dia contam a mesma história de negócio — mesmo
 * peso, mesma gordura, mesmas medidas, mesma observação — ou não. O
 * envelope (`id`, `createdAt`, `updatedAt`, e `day`, já garantido igual por
 * quem chama) nunca entra na conta: dois dispositivos gravando "80 kg" em
 * momentos diferentes não é uma divergência de negócio, é o mesmo fato
 * registrado duas vezes (achado de auditoria de design, 03/09/2026 — um
 * modal de conflito perguntando "80 kg" contra "80 kg").
 */
function bodyEntriesEqual(a: BodyEntry, b: BodyEntry): boolean {
  return deepEqual(
    {
      weightKg: a.weightKg,
      bodyFatPercent: a.bodyFatPercent,
      measurements: a.measurements,
      notes: a.notes,
    },
    {
      weightKg: b.weightKg,
      bodyFatPercent: b.bodyFatPercent,
      measurements: b.measurements,
      notes: b.notes,
    },
  );
}

export type PushBodyEntriesResult =
  | { readonly status: "nothing-pending" }
  | { readonly status: "not-authenticated" }
  | {
      readonly status: "done";
      readonly pushed: readonly string[];
      readonly conflicts: readonly string[];
      readonly errors: readonly { readonly day: string; readonly message: string }[];
    };

/**
 * Envia todo registro pendente (`listPending(tracker, "bodyEntries")`), uma
 * RPC por dia. Nunca tenta resolver um conflito sozinha — um dia já em
 * `"conflict"` nem entra na lista (`listPending` só devolve `"pending"`).
 *
 * Um dia sem registro local é uma exclusão pendente: chama
 * `delete_body_entry` em vez de `save_body_entry`. Nunca existiu no
 * servidor (`expected === null`) é o caso trivial — nada para apagar lá, só
 * volta a `"clean"`, mesmo desenho do ramo `diet === undefined` de
 * `pushOneDiet`.
 */
export async function pushAllBodyEntries(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: BodyRepository,
): Promise<PushBodyEntriesResult> {
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
    const outcome = await pushOneBodyEntry(client, tracker, localOnly, entry.recordId);
    if (outcome.status === "pushed") pushed.push(entry.recordId);
    else if (outcome.status === "conflict") conflicts.push(entry.recordId);
    else if (outcome.status === "error") errors.push({ day: entry.recordId, message: outcome.message });
  }

  return { status: "done", pushed, conflicts, errors };
}

async function pushOneBodyEntry(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: BodyRepository,
  day: string,
): Promise<{ status: "pushed" | "conflict" } | { status: "error"; message: string }> {
  const entry = await tracker.get(trackerId(STORE_NAME, day));
  const bodyEntry = await localOnly.getByDay(day);
  const expected = getExpectedServerUpdatedAt(entry);

  if (bodyEntry === undefined) {
    if (expected === null) {
      await markClean(tracker, STORE_NAME, day, null);
      return { status: "pushed" };
    }

    const { data, error } = await client.rpc<{
      server_updated_at: string;
      applied: boolean;
    }>("delete_body_entry", { p_day: day, p_expected_server_updated_at: expected });

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
  }>("save_body_entry", {
    p_day: day,
    p_weight_kg: bodyEntry.weightKg,
    p_body_fat_percent: bodyEntry.bodyFatPercent,
    p_measurements: bodyEntry.measurements,
    p_notes: bodyEntry.notes,
    p_client_updated_at: bodyEntry.updatedAt,
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

export type PullBodyEntriesResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "done";
      readonly conflicts: readonly BodyEntryConflict[];
      /** Dias cujas colunas não passaram no schema — pulados, não travam os demais. */
      readonly invalid: readonly string[];
    };

interface RemoteBodyEntryRow {
  readonly day: string;
  readonly weight_kg: number | null;
  readonly body_fat_percent: number | null;
  readonly measurements: unknown;
  readonly notes: string | null;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * `measurements` chega como `jsonb` solto, não validado pelo Postgres além
 * de "é um objeto" — mesma fronteira de confiança de qualquer payload de
 * fio. Todo site é opcional e só aceita número ou `null`: um site ausente
 * (registro de antes daquele site existir) ou `null` (não medido) são o
 * mesmo "sem valor" que `LocalBodyRepository.normalize()` já tolera na
 * leitura local — nunca `0`, que seria uma medida real.
 */
const measurementsPayloadSchema = z
  .object(
    Object.fromEntries(
      MEASUREMENT_SITES.map((site) => [site, z.number().nullable().optional()]),
    ) as Record<(typeof MEASUREMENT_SITES)[number], z.ZodOptional<z.ZodNullable<z.ZodNumber>>>,
  )
  .strict();

function fillMeasurements(parsed: z.infer<typeof measurementsPayloadSchema>): Measurements {
  const filled = {} as Record<(typeof MEASUREMENT_SITES)[number], number | null>;
  for (const site of MEASUREMENT_SITES) {
    filled[site] = parsed[site] ?? null;
  }
  return filled;
}

/**
 * Traz toda linha de `body_entries` do usuário numa query só — mesmo
 * motivo de `pullAllDiets`: achar um dia novo registrado em outro
 * dispositivo, que este não tem como pedir por id. Mesma ordem de decisão
 * por linha, ver a doc de `pullAllDiets` em `diet-sync.ts` para o
 * raciocínio completo (aqui `day` faz o papel que `id` faz lá).
 */
export async function pullAllBodyEntries(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: BodyRepository,
): Promise<PullBodyEntriesResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) {
    return { status: "not-authenticated" };
  }

  const { data, error } = await client
    .from("body_entries")
    .select("day,weight_kg,body_fat_percent,measurements,notes,client_updated_at,server_updated_at,deleted_at")
    .eq("user_id", uid);

  if (error !== null) return { status: "error", message: error.message };
  const rows = (data ?? []) as unknown as readonly RemoteBodyEntryRow[];

  const conflicts: BodyEntryConflict[] = [];
  const invalid: string[] = [];

  for (const row of rows) {
    const entry = await tracker.get(trackerId(STORE_NAME, row.day));
    const currentLocal = await localOnly.getByDay(row.day);

    if (row.deleted_at !== null) {
      // Mesmo achado de `pullAllDiets` (campanha adversarial, cenário 11):
      // só é conflito de verdade quando ainda existe uma edição local em
      // jogo — não só por o tracker ter passado por `"conflict"` no meio
      // do caminho de uma corrida de exclusão que os dois lados já
      // concordam ter perdido/ganho.
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

    const parsedMeasurements = measurementsPayloadSchema.safeParse(row.measurements ?? {});
    if (!parsedMeasurements.success) {
      invalid.push(row.day);
      continue;
    }

    const remote: BodyEntry = {
      id: row.day,
      day: row.day,
      weightKg: row.weight_kg,
      bodyFatPercent: row.body_fat_percent,
      measurements: fillMeasurements(parsedMeasurements.data),
      notes: row.notes ?? "",
      createdAt: currentLocal?.createdAt ?? row.client_updated_at,
      updatedAt: row.client_updated_at,
    };

    // Um conflito de versão só vira pergunta pro usuário quando o conteúdo
    // também diverge — duas edições que convergiram para o mesmo peso (ou
    // uma que nunca mudou nada de negócio) resolvem sozinhas, nos dois
    // pontos abaixo onde a versão por si só dizia "conflito".
    if (
      entry?.status === "conflict" ||
      (entry?.status === "pending" && entry.serverUpdatedAt !== row.server_updated_at)
    ) {
      if (currentLocal !== undefined && bodyEntriesEqual(currentLocal, remote)) {
        await localOnly.save(remote, currentLocal.updatedAt);
        await markClean(tracker, STORE_NAME, row.day, row.server_updated_at);
        continue;
      }

      await markConflict(tracker, STORE_NAME, row.day, row.server_updated_at);
      conflicts.push({ day: row.day, local: currentLocal ?? null, remote });
      continue;
    }

    if (entry?.status === "pending") {
      // `serverUpdatedAt` bate com o que já sabíamos — servidor não mudou,
      // só falta enviar a edição local.
      continue;
    }

    await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    await markClean(tracker, STORE_NAME, row.day, row.server_updated_at);
  }

  return { status: "done", conflicts, invalid };
}

export type BodyEntryConflictResolution = "keep-local" | "use-server";

/**
 * Resolve o conflito de um dia. Mesma mecânica de `resolveDietConflict` —
 * "manter local" nunca sobrescreve nada aqui, "usar servidor" aplica
 * exatamente o `remote` que `pullAllBodyEntries` devolveu (`null` remove
 * local).
 */
export async function resolveBodyEntryConflict(
  tracker: Store<SyncTracker>,
  localOnly: BodyRepository,
  day: string,
  resolution: BodyEntryConflictResolution,
  remote: BodyEntry | null,
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
