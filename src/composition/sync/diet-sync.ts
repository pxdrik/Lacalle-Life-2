import { dietPayloadSchema } from "@/composition/backup-schemas";
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
import type { Diet } from "@/features/diet/types/diet";
import type { DietRepository } from "@/features/diet/data/diet-repository";

import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "diets";

/**
 * `Diet` é a primeira entidade sincronizada com **muitos registros por
 * usuário**, ao contrário de `Profile` (um só) e `FoodLog` (um por dia).
 * `SyncTracker` já é genérico o bastante (`${store}:${recordId}`,
 * `listPending` já filtra por store) — nada mudou lá. O que muda é que
 * push/pull operam sobre uma lista de ids, não um registro fixo, e por
 * isso os resultados abaixo não são uma única `status` como em
 * `PushProfileResult`/`PullProfileResult`, e sim um lote: cada dieta pode
 * ter um destino diferente (`pushed`/`conflict`/`error`) na mesma chamada,
 * sem que uma trave as outras — mesma lição do achado 13 de
 * `food-log-sync.adversarial.test.ts` (um conflito não pode bloquear
 * silenciosamente vizinhos sem conflito nenhum), mas aqui os "vizinhos"
 * são dietas inteiras, não refeições dentro do mesmo dia.
 *
 * Família de conflito: "visível, documento inteiro" (§17.1), igual a
 * `Profile` — nunca um merge por campo como o de `FoodLog` por `Meal.id`.
 * `local`/`remote` em `DietConflict` podem ser `null` para representar "foi
 * apagada deste lado" (nunca os dois ao mesmo tempo — uma exclusão dos dois
 * lados converge em silêncio, não é conflito) — mesma linguagem que
 * `MealConflictCard` já usa para `deletedAt`.
 */
export interface DietConflict {
  readonly dietId: string;
  readonly local: Diet | null;
  readonly remote: Diet | null;
}

export type PushDietsResult =
  | { readonly status: "nothing-pending" }
  | { readonly status: "not-authenticated" }
  | {
      readonly status: "done";
      readonly pushed: readonly string[];
      readonly conflicts: readonly string[];
      readonly errors: readonly { readonly dietId: string; readonly message: string }[];
    };

/**
 * Envia toda dieta pendente (`listPending(tracker, "diets")`), uma RPC por
 * dieta. Nunca tenta resolver um conflito sozinha — uma dieta já em
 * `"conflict"` nem entra na lista (`listPending` só devolve `"pending"`).
 *
 * Uma dieta sem registro local é uma exclusão pendente: chama `delete_diet`
 * em vez de `save_diet`. Nunca existiu no servidor (`expected === null`) é
 * o caso trivial — nada para apagar lá, só volta a `"clean"`, mesmo desenho
 * do ramo `profile === undefined` de `pushProfile`.
 *
 * Uma falha de rede (RPC rejeitada, não um `{error}` retornado) interrompe
 * o laço e propaga — as dietas já processadas continuam com o resultado que
 * tiveram, e as que faltam continuam `"pending"` para a próxima tentativa.
 * Mesma resiliência a queda no meio do envio que `pushProfile`/`pushFoodLog`
 * já têm, só que aqui "no meio" pode ser entre duas dietas, não só entre
 * duas chamadas de rede da mesma dieta.
 */
export async function pushAllDiets(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: DietRepository,
): Promise<PushDietsResult> {
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
  const errors: { dietId: string; message: string }[] = [];

  for (const entry of pending) {
    const outcome = await pushOneDiet(client, tracker, localOnly, entry.recordId);
    if (outcome.status === "pushed") pushed.push(entry.recordId);
    else if (outcome.status === "conflict") conflicts.push(entry.recordId);
    else if (outcome.status === "error") errors.push({ dietId: entry.recordId, message: outcome.message });
  }

  return { status: "done", pushed, conflicts, errors };
}

async function pushOneDiet(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: DietRepository,
  dietId: string,
): Promise<{ status: "pushed" | "conflict" } | { status: "error"; message: string }> {
  const entry = await tracker.get(trackerId(STORE_NAME, dietId));
  const diet = await localOnly.getById(dietId);
  const expected = getExpectedServerUpdatedAt(entry);

  if (diet === undefined) {
    if (expected === null) {
      await markClean(tracker, STORE_NAME, dietId, null);
      return { status: "pushed" };
    }

    const { data, error } = await client.rpc<{
      server_updated_at: string;
      applied: boolean;
    }>("delete_diet", { p_id: dietId, p_expected_server_updated_at: expected });

    if (error !== null) return { status: "error", message: error.message };
    const result = data?.[0];
    if (result === undefined) return { status: "error", message: "empty response" };

    if (result.applied) {
      await markClean(tracker, STORE_NAME, dietId, result.server_updated_at);
      return { status: "pushed" };
    }

    await markConflict(tracker, STORE_NAME, dietId, result.server_updated_at);
    return { status: "conflict" };
  }

  const { data, error } = await client.rpc<{
    server_updated_at: string;
    applied: boolean;
  }>("save_diet", {
    p_id: dietId,
    p_payload: { name: diet.name, meals: diet.meals, weekdays: diet.weekdays },
    p_client_updated_at: diet.updatedAt,
    p_expected_server_updated_at: expected,
  });

  if (error !== null) return { status: "error", message: error.message };
  const result = data?.[0];
  if (result === undefined) return { status: "error", message: "empty response" };

  if (result.applied) {
    await markClean(tracker, STORE_NAME, dietId, result.server_updated_at);
    return { status: "pushed" };
  }

  await markConflict(tracker, STORE_NAME, dietId, result.server_updated_at);
  return { status: "conflict" };
}

export type PullDietsResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "done";
      readonly conflicts: readonly DietConflict[];
      /** Ids cujo `payload` não passou no schema — puladas, não travam as demais. */
      readonly invalid: readonly string[];
    };

interface RemoteDietRow {
  readonly id: string;
  readonly payload: unknown;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Traz toda linha de `diets` do usuário numa query só (nunca uma por id —
 * o ponto de trazer tudo de uma vez é achar dietas novas de outro
 * dispositivo, que este dispositivo não tem como saber pedir por id).
 *
 * Cada linha segue, nesta ordem: já em conflito conhecido → continua
 * bloqueada, só atualiza a versão do servidor e reapresenta o par; tombada
 * remotamente → aplica a exclusão local se não há edição local pendente,
 * ou vira conflito de exclusão-vs-edição se há; pendência local com o
 * servidor tendo avançado desde a última vez que este dispositivo soube →
 * conflito; do contrário aplica o remoto (dieta nova de outro dispositivo,
 * ou uma atualização limpa).
 */
export async function pullAllDiets(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: DietRepository,
): Promise<PullDietsResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) {
    return { status: "not-authenticated" };
  }

  const { data, error } = await client
    .from("diets")
    .select("id,payload,client_updated_at,server_updated_at,deleted_at")
    .eq("user_id", uid);

  if (error !== null) return { status: "error", message: error.message };
  const rows = (data ?? []) as unknown as readonly RemoteDietRow[];

  const conflicts: DietConflict[] = [];
  const invalid: string[] = [];

  for (const row of rows) {
    const entry = await tracker.get(trackerId(STORE_NAME, row.id));
    const currentLocal = await localOnly.getById(row.id);

    if (row.deleted_at !== null) {
      // `currentLocal !== undefined` é o que decide se há algo a proteger —
      // não o status do tracker sozinho. Achado atacando de verdade
      // (campanha adversarial, cenário 11): os dois dispositivos apagando a
      // mesma dieta sem nunca ter puxado um do outro é uma corrida de
      // versão que `pushOneDiet` perde e marca `"conflict"` de propósito
      // (nunca sobrescreve em silêncio, §22.3) — mas os dois lados já
      // concordam no resultado (nada), então reapresentar isso como um
      // conflito que exige um clique do usuário seria pedir para resolver
      // algo que já está resolvido. Só quando ainda existe uma edição local
      // (`currentLocal !== undefined`) há de fato algo em jogo: manter essa
      // edição ou aceitar a exclusão do outro lado.
      if ((entry?.status === "pending" || entry?.status === "conflict") && currentLocal !== undefined) {
        // `remote: null` é o que decide "apagada" para `resolveDietConflict`
        // e para a UI — nunca a presença de `payload`, que sobrevive à
        // exclusão no banco (`delete_diet` só grava `deleted_at`, §19.2) mas
        // não é o que importa aqui.
        await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
        conflicts.push({ dietId: row.id, local: currentLocal, remote: null });
        continue;
      }

      // Sem edição local a proteger: os dois lados concordam que sumiu (ou
      // nunca houve pendência nenhuma) — converge em silêncio, mesmo que o
      // tracker estivesse `"conflict"` por ter perdido a corrida do delete.
      if (currentLocal !== undefined) {
        await localOnly.remove(row.id);
      }
      await markClean(tracker, STORE_NAME, row.id, row.server_updated_at);
      continue;
    }

    const parsed = dietPayloadSchema.safeParse(row.payload);
    if (!parsed.success) {
      invalid.push(row.id);
      continue;
    }

    const remote: Diet = {
      id: row.id,
      name: parsed.data.name,
      meals: parsed.data.meals,
      weekdays: parsed.data.weekdays,
      createdAt: currentLocal?.createdAt ?? row.client_updated_at,
      updatedAt: row.client_updated_at,
    };

    if (entry?.status === "conflict") {
      await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
      conflicts.push({ dietId: row.id, local: currentLocal ?? null, remote });
      continue;
    }

    if (entry?.status === "pending") {
      if (entry.serverUpdatedAt !== row.server_updated_at) {
        await markConflict(tracker, STORE_NAME, row.id, row.server_updated_at);
        conflicts.push({ dietId: row.id, local: currentLocal ?? null, remote });
        continue;
      }
      // Servidor não mudou desde a última vez que soubemos — só falta
      // enviar a edição local, o próximo push cuida disso.
      continue;
    }

    // Limpa (ou nunca vista antes — dieta nova de outro dispositivo).
    await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    await markClean(tracker, STORE_NAME, row.id, row.server_updated_at);
  }

  return { status: "done", conflicts, invalid };
}

export type DietConflictResolution = "keep-local" | "use-server";

/**
 * Resolve um conflito de uma dieta. "Manter local" nunca sobrescreve nada
 * aqui — se a dieta ainda existe localmente, ela já é o que vai ser
 * enviado; se foi apagada localmente, a exclusão pendente permanece. "Usar
 * servidor" aplica exatamente o que `pullAllDiets` devolveu como `remote`:
 * `null` remove local (o outro lado apagou), um `Diet` sobrescreve.
 *
 * `remote` vem do resultado de `pullAllDiets` — nunca buscado de novo aqui,
 * mesma regra de `resolveProfileConflict`/`resolveFoodLogConflict`: a
 * resolução sempre decide sobre exatamente o par que a UI mostrou.
 */
export async function resolveDietConflict(
  tracker: Store<SyncTracker>,
  localOnly: DietRepository,
  dietId: string,
  resolution: DietConflictResolution,
  remote: Diet | null,
): Promise<void> {
  if (resolution === "use-server") {
    const entry = await tracker.get(trackerId(STORE_NAME, dietId));
    const serverUpdatedAt = getExpectedServerUpdatedAt(entry);
    const currentLocal = await localOnly.getById(dietId);

    if (remote === null) {
      if (currentLocal !== undefined) await localOnly.remove(dietId);
    } else {
      await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    }

    await markClean(tracker, STORE_NAME, dietId, serverUpdatedAt);
    return;
  }

  await forcePendingAfterResolution(tracker, STORE_NAME, dietId);
}
