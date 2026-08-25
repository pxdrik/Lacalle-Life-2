import { nutritionProfileSchema } from "@/core/nutrition";
import type { Store } from "@/core/storage/store";
import {
  getExpectedServerUpdatedAt,
  markPending,
  markPulled,
  markPushed,
  trackerId,
  type SyncTracker,
} from "@/core/sync/sync-tracker";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";
import type { ProfileRepository } from "@/features/profile/data/profile-repository";

import type { SyncSupabaseClient } from "./sync-supabase-client";

const STORE_NAME = "profile";

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
 * Nunca decide sozinho o que fazer num conflito — `applied: false` só
 * atualiza a versão do servidor conhecida (`markPulled`, preservando a
 * pendência) e devolve `"conflict"`. É quem chama que decide reagir,
 * exatamente como o conflito local de duas abas já funciona hoje.
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
  if (entry?.pendingPush !== true) {
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
      // Nunca existiu no servidor — nada a apagar lá, só desliga a pendência.
      await markPending(tracker, STORE_NAME, PROFILE_ID);
      const cleared = await tracker.get(trackerId(STORE_NAME, PROFILE_ID));
      if (cleared !== undefined) {
        await tracker.put({ ...cleared, pendingPush: false });
      }
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
      await markPushed(tracker, STORE_NAME, PROFILE_ID, result.server_updated_at);
      return { status: "deleted-remote" };
    }

    await markPulled(tracker, STORE_NAME, PROFILE_ID, result.server_updated_at);
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
    await markPushed(tracker, STORE_NAME, PROFILE_ID, result.server_updated_at);
    return { status: "pushed" };
  }

  await markPulled(tracker, STORE_NAME, PROFILE_ID, result.server_updated_at);
  return { status: "conflict" };
}

export type PullProfileResult =
  | { readonly status: "not-authenticated" }
  | { readonly status: "no-remote-data" }
  | { readonly status: "applied" }
  | { readonly status: "local-pending-conflict" }
  | { readonly status: "invalid-payload" }
  | { readonly status: "error"; readonly message: string };

interface RemoteProfileRow {
  readonly payload: unknown;
  readonly client_updated_at: number;
  readonly server_updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Traz o `profile` do servidor, se houver, e aplica localmente — **exceto**
 * quando há uma edição local ainda não enviada (`pendingPush`), caso em que
 * sobrescrever silenciosamente é exatamente o que a arquitetura proíbe
 * (docs/arquitetura-sincronizacao.md §8.1/§17.1). Nesse caso só atualiza a
 * versão do servidor conhecida e devolve `"local-pending-conflict"`.
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

  const entry = await tracker.get(trackerId(STORE_NAME, PROFILE_ID));
  if (entry?.pendingPush === true) {
    await markPulled(tracker, STORE_NAME, PROFILE_ID, row.server_updated_at);
    return { status: "local-pending-conflict" };
  }

  const parsed = nutritionProfileSchema.safeParse(row.payload);
  if (!parsed.success) {
    return { status: "invalid-payload" };
  }

  const profile: Profile = {
    id: PROFILE_ID,
    nutrition: parsed.data,
    createdAt: row.client_updated_at,
    updatedAt: row.client_updated_at,
  };

  // `expectedUpdatedAt: null` só é válido para criar um registro que ainda
  // não existe localmente — achado testando de verdade: sem isto, aplicar
  // um pull sobre um registro que já existe local (o caso comum, não a
  // exceção) sempre lançava DataError("CONFLICT") do próprio OCC local,
  // mesmo sem nenhuma edição pendente de verdade.
  const currentLocal = await localOnly.get();
  await localOnly.save(profile, currentLocal?.updatedAt ?? null);
  await markPulled(tracker, STORE_NAME, PROFILE_ID, row.server_updated_at);
  return { status: "applied" };
}
