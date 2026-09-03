import { deepEqual } from "@/core/domain/deep-equal";
import { nutritionProfileSchema } from "@/core/nutrition";
import type { Store } from "@/core/storage/store";
import {
  getExpectedServerUpdatedAt,
  markClean,
  markConflict,
  forcePendingAfterResolution,
  trackerId,
  type SyncTracker,
} from "@/core/sync/sync-tracker";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";
import type { ProfileRepository } from "@/features/profile/data/profile-repository";

import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "profile";

/**
 * Dois perfis contam a mesma pessoa — mesmos dados de entrada para o
 * cálculo de meta (sexo, idade, altura, peso, atividade, objetivo, etc.).
 * Envelope (`id`, `createdAt`, `updatedAt`) fora da conta, mesmo raciocínio
 * de `bodyEntriesEqual` em `body-entry-sync.ts` (achado de auditoria de
 * design, 03/09/2026).
 */
function profilesEqual(a: Profile, b: Profile): boolean {
  return deepEqual(a.nutrition, b.nutrition);
}

export type PushProfileResult =
  | { readonly status: "nothing-pending" }
  | { readonly status: "not-authenticated" }
  | { readonly status: "pushed" }
  | { readonly status: "deleted-remote" }
  | { readonly status: "conflict" }
  | { readonly status: "error"; readonly message: string };

/**
 * Envia a edição local pendente de `profile`, se houver.
 *
 * **Nunca tenta resolver um conflito sozinho.** Se o tracker já está em
 * `"conflict"`, devolve `"conflict"` sem chamar o servidor — só
 * `resolveProfileConflict` destrava isto. E se esta chamada perder uma
 * corrida (`applied: false`), o resultado é o mesmo bloqueio, não uma
 * sobrescrita silenciosa na próxima tentativa. Ver
 * docs/arquitetura-sincronizacao.md §22.3.
 *
 * `localOnly` tem que ser o `LocalProfileRepository` puro, nunca o
 * `SyncingProfileRepository` — chamar `.get()` não teria problema nos dois,
 * mas o nome existe para deixar claro que esta função é o único lugar
 * autorizado a ler o estado local para decidir o que empurrar, e nunca deve
 * passar pelo decorator que reenfileira.
 */
export async function pushProfile(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: ProfileRepository,
): Promise<PushProfileResult> {
  const entry = await tracker.get(trackerId(STORE_NAME, PROFILE_ID));

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

  const profile = await localOnly.get();
  const expected = getExpectedServerUpdatedAt(entry);

  if (profile === undefined) {
    if (expected === null) {
      // Nunca existiu no servidor — nada a apagar lá, só volta a "clean".
      await markClean(tracker, STORE_NAME, PROFILE_ID, null);
      return { status: "deleted-remote" };
    }

    const { data, error } = await client.rpc<{
      server_updated_at: string;
      applied: boolean;
    }>("delete_profile", { p_expected_server_updated_at: expected });

    if (error !== null) return { status: "error", message: error.message };
    const result = data?.[0];
    if (result === undefined) return { status: "error", message: "empty response" };

    if (result.applied) {
      await markClean(tracker, STORE_NAME, PROFILE_ID, result.server_updated_at);
      return { status: "deleted-remote" };
    }

    await markConflict(tracker, STORE_NAME, PROFILE_ID, result.server_updated_at);
    return { status: "conflict" };
  }

  const { data, error } = await client.rpc<{
    server_updated_at: string;
    applied: boolean;
  }>("save_profile", {
    p_payload: profile.nutrition,
    p_client_updated_at: profile.updatedAt,
    p_expected_server_updated_at: expected,
  });

  if (error !== null) return { status: "error", message: error.message };
  const result = data?.[0];
  if (result === undefined) return { status: "error", message: "empty response" };

  if (result.applied) {
    await markClean(tracker, STORE_NAME, PROFILE_ID, result.server_updated_at);
    return { status: "pushed" };
  }

  // Corrida real: alguém mudou o servidor entre a leitura da versão
  // esperada e esta chamada. Bloqueia — não tenta de novo sozinho.
  await markConflict(tracker, STORE_NAME, PROFILE_ID, result.server_updated_at);
  return { status: "conflict" };
}

export type PullProfileResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "no-remote-data" }
  | { readonly status: "applied" }
  | { readonly status: "pending-unpushed" }
  | { readonly status: "conflict"; readonly local: Profile; readonly remote: Profile }
  | { readonly status: "invalid-payload" }
  | { readonly status: "error"; readonly message: string };

interface RemoteProfileRow {
  readonly payload: unknown;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Traz o `profile` do servidor, se houver.
 *
 * Sem pendência local: aplica direto. Com pendência local mas o servidor
 * não mudou desde a última vez que este dispositivo olhou: `"pending-unpushed"`
 * — ainda não há nada para resolver, só falta enviar. Com pendência local
 * **e** o servidor mudou (ou já havia um conflito conhecido): `"conflict"`,
 * carregando os dois valores para a UI decidir — nunca aplica nem descarta
 * nada sozinho (docs/arquitetura-sincronizacao.md §8.1/§17.1/§22.3).
 *
 * `payload` nunca é confiado só por ter vindo do próprio banco — mesma
 * validação Zod que já protege um backup importado (§19.8), fechando a
 * mesma classe de bug que `backup-schemas.ts` já fechou para arquivo.
 */
export async function pullProfile(
  client: SyncSupabaseClient,
  tracker: Store<SyncTracker>,
  localOnly: ProfileRepository,
): Promise<PullProfileResult> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (uid === undefined) {
    return { status: "not-authenticated" };
  }

  const { data, error } = await client
    .from("profiles")
    .select("payload,client_updated_at,server_updated_at,deleted_at")
    .eq("user_id", uid);

  if (error !== null) return { status: "error", message: error.message };
  const rows = (data ?? []) as unknown as readonly RemoteProfileRow[];
  const row = rows[0];

  if (row === undefined || row.deleted_at !== null) {
    return { status: "no-remote-data" };
  }

  const parsed = nutritionProfileSchema.safeParse(row.payload);
  if (!parsed.success) {
    return { status: "invalid-payload" };
  }

  const remote: Profile = {
    id: PROFILE_ID,
    nutrition: parsed.data,
    createdAt: row.client_updated_at,
    updatedAt: row.client_updated_at,
  };

  const entry = await tracker.get(trackerId(STORE_NAME, PROFILE_ID));
  const currentLocal = await localOnly.get();

  // Um conflito de versão só vira pergunta pro usuário quando o perfil
  // também diverge de verdade — ver `bodyEntriesEqual` em
  // `body-entry-sync.ts` para o raciocínio completo. Duas edições que
  // convergiram para os mesmos dados (ou uma que nunca mudou nada de
  // negócio) resolvem sozinhas.
  if (
    entry?.status === "conflict" ||
    (entry?.status === "pending" && entry.serverUpdatedAt !== row.server_updated_at)
  ) {
    if (currentLocal !== undefined && profilesEqual(currentLocal, remote)) {
      await localOnly.save(remote, currentLocal.updatedAt);
      await markClean(tracker, STORE_NAME, PROFILE_ID, row.server_updated_at);
      return { status: "applied" };
    }

    // Já bloqueado (ou acabou de ficar) — atualiza a versão do servidor
    // conhecida (pode ter avançado de novo) e devolve os dois valores para
    // a UI decidir. Nunca sobrescreve nenhum dos dois sozinho.
    await markConflict(tracker, STORE_NAME, PROFILE_ID, row.server_updated_at);
    return { status: "conflict", local: currentLocal ?? remote, remote };
  }

  if (entry?.status === "pending") {
    // O servidor não mudou — só ainda não enviamos a nossa edição local.
    return { status: "pending-unpushed" };
  }

  // `expectedUpdatedAt: null` só é válido para criar um registro que ainda
  // não existe localmente — achado testando de verdade: sem isto, aplicar
  // um pull sobre um registro que já existe local (o caso comum, não a
  // exceção) sempre lançava DataError("CONFLICT") do próprio OCC local,
  // mesmo sem nenhuma edição pendente de verdade.
  await localOnly.save(remote, currentLocal?.updatedAt ?? null);
  await markClean(tracker, STORE_NAME, PROFILE_ID, row.server_updated_at);
  return { status: "applied" };
}

export type ProfileConflictResolution = "keep-local" | "use-server";

/**
 * Única forma de sair de `"conflict"`. A UI escolhe entre manter a edição
 * local (o motor destrava o próximo push, que vai usar a versão do
 * servidor mais recente conhecida como base — uma sobrescrita explícita,
 * escolhida pelo usuário, não automática) ou usar o valor do servidor
 * (descarta o rascunho local e aplica `remote`).
 *
 * `remote` vem do resultado `"conflict"` de `pullProfile` — nunca é
 * buscado de novo aqui, para a UI sempre resolver exatamente o par de
 * valores que mostrou na tela, não um terceiro estado que chegou entre o
 * clique e esta chamada.
 */
export async function resolveProfileConflict(
  tracker: Store<SyncTracker>,
  localOnly: ProfileRepository,
  resolution: ProfileConflictResolution,
  remote: Profile,
): Promise<void> {
  if (resolution === "use-server") {
    const entry = await tracker.get(trackerId(STORE_NAME, PROFILE_ID));
    const serverUpdatedAt = getExpectedServerUpdatedAt(entry);
    const currentLocal = await localOnly.get();
    await localOnly.save(remote, currentLocal?.updatedAt ?? null);
    await markClean(tracker, STORE_NAME, PROFILE_ID, serverUpdatedAt);
    return;
  }

  await forcePendingAfterResolution(tracker, STORE_NAME, PROFILE_ID);
}
