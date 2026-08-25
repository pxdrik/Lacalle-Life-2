import { z } from "zod";

import { mealSchema } from "@/composition/backup-schemas";
import type { Store } from "@/core/storage/store";
import {
  getExpectedServerUpdatedAt,
  markClean,
  markConflict,
  markPendingWithSnapshot,
  forcePendingAfterResolution,
  trackerId,
  type SyncTracker,
} from "@/core/sync/sync-tracker";
import type { FoodLog } from "@/features/diet/types/food-log";
import type { FoodLogRepository } from "@/features/diet/data/food-log-repository";

import {
  mergeFoodLogMeals,
  wireMealsEqual,
  type MealConflict,
  type WireMeal,
} from "./food-log-merge";
import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "foodLog";

/**
 * Formato de fio de `food_logs.payload` — a única representação que carrega
 * `deletedAt` por refeição. Estende `mealSchema` (o mesmo usado para
 * validar backup) em vez de duplicar as regras, mas o resultado nunca é o
 * `Meal` de domínio: passa por `mergeFoodLogMeals` antes de tocar o
 * `FoodLogRepository`.
 */
const wireMealSchema = mealSchema.extend({ deletedAt: z.string().nullable() });
const foodLogWirePayloadSchema = z
  .object({
    meals: z.array(wireMealSchema),
    dietId: z.string().nullable(),
  })
  .strict();

function snapshotFrom(entry: SyncTracker | undefined): readonly WireMeal[] | null {
  if (entry?.snapshot === undefined) return null;
  const parsed = z.array(wireMealSchema).safeParse(entry.snapshot);
  return parsed.success ? parsed.data : null;
}

export type PushFoodLogResult =
  | { readonly status: "nothing-pending" }
  | { readonly status: "not-authenticated" }
  | { readonly status: "pushed" }
  | { readonly status: "conflict" }
  | { readonly status: "error"; readonly message: string };

/**
 * Envia o dia pendente, se houver — mesmo desenho de `pushProfile`: nunca
 * chama o servidor enquanto `status === "conflict"`, e uma corrida real
 * (`applied: false`) bloqueia em vez de tentar de novo sozinha.
 *
 * O payload enviado é reconstruído a partir do local ao vivo + do último
 * snapshot conhecido (`mergeFoodLogMeals(local, snapshot, snapshot)` —
 * mesclar contra si mesmo produz exatamente "local como fio", com
 * tombstones para o que foi apagado desde então, sem nenhum conflito
 * possível, porque não há um segundo lado real envolvido).
 */
export async function pushFoodLog(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: FoodLogRepository,
  day: string,
): Promise<PushFoodLogResult> {
  const entry = await tracker.get(trackerId(STORE_NAME, day));

  if (entry?.status === "conflict") {
    return { status: "conflict" };
  }
  if (entry?.status !== "pending") {
    return { status: "nothing-pending" };
  }

  const { data: userData } = await client.auth.getUser();
  if (userData.user === null) {
    return { status: "not-authenticated" };
  }

  const log = await localOnly.getByDay(day);
  const snapshot = snapshotFrom(entry);
  const localMeals = log?.meals ?? [];
  const asWire = mergeFoodLogMeals(localMeals, snapshot ?? [], snapshot).wireMeals;
  const expected = getExpectedServerUpdatedAt(entry);

  const { data, error } = await client.rpc<{
    server_updated_at: string;
    applied: boolean;
  }>("save_food_log", {
    p_day: day,
    p_payload: { meals: asWire, dietId: log?.dietId ?? null },
    p_client_updated_at: log?.updatedAt ?? Date.now(),
    p_expected_server_updated_at: expected,
  });

  if (error !== null) return { status: "error", message: error.message };
  const result = data?.[0];
  if (result === undefined) return { status: "error", message: "empty response" };

  if (result.applied) {
    await markClean(tracker, STORE_NAME, day, result.server_updated_at, asWire);
    return { status: "pushed" };
  }

  await markConflict(tracker, STORE_NAME, day, result.server_updated_at, snapshot ?? []);
  return { status: "conflict" };
}

export type PullFoodLogResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "no-remote-data" }
  | { readonly status: "applied" }
  | { readonly status: "pending-unpushed" }
  | { readonly status: "conflict"; readonly conflicts: readonly MealConflict[] }
  | { readonly status: "invalid-payload" }
  | { readonly status: "error"; readonly message: string };

interface RemoteFoodLogRow {
  readonly payload: unknown;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Traz o dia do servidor e faz o merge por `Meal.id` (§19.5) contra o
 * local e contra o último snapshot conhecido. Nunca aplica um merge com
 * conflito — grava o snapshot bruto e devolve os pares para a UI decidir,
 * do mesmo jeito que `pullProfile` nunca resolve um conflito sozinho.
 */
export async function pullFoodLog(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: FoodLogRepository,
  day: string,
): Promise<PullFoodLogResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) {
    return { status: "not-authenticated" };
  }

  const { data, error } = await client
    .from("food_logs")
    .select("payload,client_updated_at,server_updated_at,deleted_at")
    .eq("user_id", uid)
    .eq("day", day);

  if (error !== null) return { status: "error", message: error.message };
  const rows = (data ?? []) as unknown as readonly RemoteFoodLogRow[];
  const row = rows[0];

  if (row === undefined || row.deleted_at !== null) {
    return { status: "no-remote-data" };
  }

  const parsed = foodLogWirePayloadSchema.safeParse(row.payload);
  if (!parsed.success) {
    return { status: "invalid-payload" };
  }

  const entry = await tracker.get(trackerId(STORE_NAME, day));
  const snapshot = snapshotFrom(entry);
  const currentLocal = await localOnly.getByDay(day);
  const localMeals = currentLocal?.meals ?? [];

  const merge = mergeFoodLogMeals(localMeals, parsed.data.meals, snapshot);

  if (merge.conflicts.length > 0) {
    await markConflict(tracker, STORE_NAME, day, row.server_updated_at, merge.wireMeals);
    return { status: "conflict", conflicts: merge.conflicts };
  }

  const now = Date.now();
  const nextLog: FoodLog = {
    id: day,
    day,
    meals: merge.liveMeals,
    dietId: currentLocal?.dietId ?? parsed.data.dietId,
    createdAt: currentLocal?.createdAt ?? now,
    updatedAt: now,
  };
  await localOnly.save(nextLog, currentLocal?.updatedAt ?? null);

  if (wireMealsEqual(merge.wireMeals, parsed.data.meals)) {
    // Nada além do que o servidor já tem — o merge só absorveu remoto.
    await markClean(tracker, STORE_NAME, day, row.server_updated_at, merge.wireMeals);
    return { status: "applied" };
  }

  // O merge trouxe algo que o servidor ainda não tem (uma adição/exclusão
  // local que não tinha sido enviada) — o local já foi atualizado com o
  // resultado da união, mas ainda falta um push para o servidor saber
  // dessa parte. Diferente do "pending-unpushed" de `pullProfile`, que não
  // toca em nada local: aqui o merge sempre aplica, e este status só
  // sinaliza que o ciclo não terminou.
  await markPendingWithSnapshot(
    tracker,
    STORE_NAME,
    day,
    row.server_updated_at,
    merge.wireMeals,
  );
  return { status: "pending-unpushed" };
}

export type FoodLogConflictResolution = "keep-local" | "use-server";

/**
 * Resolve um subconjunto (ou todos) dos conflitos de um dia. Cada escolha
 * é por `Meal.id` — "manter local" preserva a versão local daquela
 * refeição no próximo payload, "usar servidor" troca pela versão remota.
 * Refeições fora da lista de resolução, se ainda em conflito, continuam
 * bloqueando o dia.
 */
export async function resolveFoodLogConflict(
  tracker: Store<SyncTracker>,
  localOnly: FoodLogRepository,
  day: string,
  conflicts: readonly MealConflict[],
  resolutions: ReadonlyMap<string, FoodLogConflictResolution>,
): Promise<void> {
  const current = await localOnly.getByDay(day);
  const currentById = new Map((current?.meals ?? []).map((meal) => [meal.id, meal]));

  const stillConflicting = conflicts.filter(
    (conflict) => !resolutions.has(conflict.mealId),
  );

  // "Manter local" nunca muda nada em `currentById` — local já é local. Só
  // "usar servidor" precisa aplicar algo: sobrescreve com o conteúdo
  // remoto, ou remove se o remoto era um tombstone.
  for (const conflict of conflicts) {
    if (resolutions.get(conflict.mealId) !== "use-server") continue;
    if (conflict.remote.deletedAt !== null) {
      currentById.delete(conflict.mealId);
    } else {
      const { deletedAt: _deletedAt, ...live } = conflict.remote;
      currentById.set(conflict.mealId, live);
    }
  }

  const now = Date.now();
  const nextLog: FoodLog = {
    id: day,
    day,
    meals: [...currentById.values()],
    dietId: current?.dietId ?? null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await localOnly.save(nextLog, current?.updatedAt ?? null);

  if (stillConflicting.length > 0) {
    // Ainda há conflito não resolvido nesta chamada — permanece bloqueado.
    return;
  }

  // O snapshot precisa refletir a resolução, não o placeholder que
  // `markConflict` gravou durante o pull — senão o próximo merge compararia
  // contra uma base que já não é a decisão real do usuário. "Manter local"
  // já bate com o snapshot gravado (a mecânica de conflito preserva o lado
  // local); só "usar servidor" precisa trocar a entrada.
  const entry = await tracker.get(trackerId(STORE_NAME, day));
  const snapshot = snapshotFrom(entry) ?? [];
  const resolvedSnapshot = snapshot.map((meal) => {
    const conflict = conflicts.find((c) => c.mealId === meal.id);
    if (conflict === undefined || resolutions.get(conflict.mealId) !== "use-server") {
      return meal;
    }
    return conflict.remote;
  });

  // Sempre volta para "pending", mesmo quando a resolução foi só "usar
  // servidor" em tudo e não sobra nada de novo para enviar. Tentar decidir
  // aqui se o push seguinte seria um no-op exigiria comparar contra o
  // payload remoto de verdade (que esta função não tem — só tem os pares
  // de conflito, não o dia inteiro) — a primeira tentativa de fazer essa
  // conta usando o snapshot gravado em `markConflict` (que para uma
  // refeição em conflito guarda o lado *local*, não o do servidor) marcava
  // "clean" por engano depois de "manter local", como se nada precisasse
  // subir. Mandar de novo quando já está tudo igual é um push idempotente
  // e inofensivo (§22.5/cenário 13) — a inconsistência que valeria a pena
  // evitar não é essa.
  await forcePendingAfterResolution(tracker, STORE_NAME, day, resolvedSnapshot);
}
