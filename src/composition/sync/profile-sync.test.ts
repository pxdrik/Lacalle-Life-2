import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";

import { pullProfile, pushProfile, resolveProfileConflict } from "./profile-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

function authenticatedClient(
  overrides: Partial<SyncSupabaseClient> = {},
): SyncSupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
    rpc: vi.fn(),
    from: vi.fn(),
    ...overrides,
  };
}

function profile(weightKg = 80, updatedAt = 1000): Profile {
  return {
    id: PROFILE_ID,
    nutrition: {
      sex: "male",
      ageYears: 30,
      heightCm: 175,
      weightKg,
      activityLevel: "moderate",
      goal: "maintain",
    },
    createdAt: 1000,
    updatedAt,
  };
}

describe("pushProfile", () => {
  let tracker: MemoryStore<SyncTracker>;
  let local: LocalProfileRepository;

  beforeEach(() => {
    tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
    local = new LocalProfileRepository(new MemoryStore<Profile>(PROFILE_STORE));
  });

  it("does nothing when there is no pending mutation", async () => {
    const client = authenticatedClient();
    const result = await pushProfile(client, tracker, local);
    expect(result).toEqual({ status: "nothing-pending" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("creates the profile on the server on first push", async () => {
    await local.save(profile(), null);
    await markPending(tracker, "profile", PROFILE_ID);

    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ server_updated_at: "2026-01-01T00:00:00Z", applied: true }], error: null });
    const client = authenticatedClient({ rpc });

    const result = await pushProfile(client, tracker, local);

    expect(result).toEqual({ status: "pushed" });
    expect(rpc).toHaveBeenCalledWith("save_profile", {
      p_payload: profile().nutrition,
      p_client_updated_at: 1000,
      p_expected_server_updated_at: null,
    });

    const entry = await tracker.get("profile:me");
    expect(entry?.status).toBe("clean");
    expect(entry?.serverUpdatedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("blocks on conflict instead of overwriting on the next attempt", async () => {
    await local.save(profile(), null);
    await markPending(tracker, "profile", PROFILE_ID);

    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ server_updated_at: "2026-06-01T00:00:00Z", applied: false }], error: null });
    const client = authenticatedClient({ rpc });

    const result = await pushProfile(client, tracker, local);

    expect(result).toEqual({ status: "conflict" });
    const entry = await tracker.get("profile:me");
    expect(entry?.status).toBe("conflict");
    expect(entry?.serverUpdatedAt).toBe("2026-06-01T00:00:00Z");

    // Tentar de novo sem resolver não chama o servidor de novo — continua
    // bloqueado, nunca vira uma sobrescrita silenciosa.
    rpc.mockClear();
    const secondAttempt = await pushProfile(client, tracker, local);
    expect(secondAttempt).toEqual({ status: "conflict" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not call the server when a delete has nothing to delete remotely", async () => {
    // Nunca sincronizado (nenhum tracker com serverUpdatedAt), e localmente
    // já apagado — não há o que apagar no servidor.
    await markPending(tracker, "profile", PROFILE_ID);
    const rpc = vi.fn();
    const client = authenticatedClient({ rpc });

    const result = await pushProfile(client, tracker, local);

    expect(result).toEqual({ status: "deleted-remote" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("resolving a conflict with keep-local unblocks the next push", async () => {
    await local.save(profile(60), null);
    await markPending(tracker, "profile", PROFILE_ID);

    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ server_updated_at: "2026-06-01T00:00:00Z", applied: false }], error: null });
    const client = authenticatedClient({ rpc });
    await pushProfile(client, tracker, local);
    expect((await tracker.get("profile:me"))?.status).toBe("conflict");

    await resolveProfileConflict(tracker, local, "keep-local", profile(95, 5000));
    expect((await tracker.get("profile:me"))?.status).toBe("pending");

    rpc.mockResolvedValue({
      data: [{ server_updated_at: "2026-06-02T00:00:00Z", applied: true }],
      error: null,
    });
    const retry = await pushProfile(client, tracker, local);
    expect(retry).toEqual({ status: "pushed" });
    // O valor enviado foi o local (60), que "manter local" preservou — não
    // o `remote` passado só para a UI mostrar o que foi descartado.
    expect(rpc).toHaveBeenCalledWith(
      "save_profile",
      expect.objectContaining({ p_payload: profile(60).nutrition }),
    );
  });

  it("resolving a conflict with use-server discards the local draft and marks clean", async () => {
    await local.save(profile(60), null);
    await markPending(tracker, "profile", PROFILE_ID);

    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ server_updated_at: "2026-06-01T00:00:00Z", applied: false }], error: null });
    const client = authenticatedClient({ rpc });
    await pushProfile(client, tracker, local);

    await resolveProfileConflict(tracker, local, "use-server", profile(95, 5000));

    expect((await tracker.get("profile:me"))?.status).toBe("clean");
    expect((await local.get())?.nutrition.weightKg).toBe(95);

    // E o próximo push não tem mais nada pendente.
    expect(await pushProfile(client, tracker, local)).toEqual({ status: "nothing-pending" });
  });
});

describe("pullProfile", () => {
  let tracker: MemoryStore<SyncTracker>;
  let local: LocalProfileRepository;

  beforeEach(() => {
    tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
    local = new LocalProfileRepository(new MemoryStore<Profile>(PROFILE_STORE));
  });

  function fromReturning(rows: readonly Record<string, unknown>[]) {
    return vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    });
  }

  it("applies the remote profile when there is no local pending change", async () => {
    const from = fromReturning([
      {
        payload: profile(90).nutrition,
        client_updated_at: 5000,
        server_updated_at: "2026-02-01T00:00:00Z",
        deleted_at: null,
      },
    ]);
    const client = authenticatedClient({ from });

    const result = await pullProfile(client, tracker, local);

    expect(result).toEqual({ status: "applied" });
    const saved = await local.get();
    expect(saved?.nutrition.weightKg).toBe(90);
  });

  it("applies the remote profile over an existing local record without a pending edit", async () => {
    // O caso comum, não a exceção: já existe um profile local (de um push
    // anterior, ou de antes de sincronização existir), sem edição pendente.
    // `expectedUpdatedAt: null` sozinho lançaria DataError("CONFLICT") do
    // OCC local aqui — achado testando de verdade contra o Supabase real.
    await local.save(profile(70), null);

    const from = fromReturning([
      {
        payload: profile(90).nutrition,
        client_updated_at: 5000,
        server_updated_at: "2026-02-01T00:00:00Z",
        deleted_at: null,
      },
    ]);
    const client = authenticatedClient({ from });

    const result = await pullProfile(client, tracker, local);

    expect(result).toEqual({ status: "applied" });
    const saved = await local.get();
    expect(saved?.nutrition.weightKg).toBe(90);
  });

  it("flags a real conflict instead of overwriting when a local edit is pending and the server moved", async () => {
    await local.save(profile(70), null);
    await markPending(tracker, "profile", PROFILE_ID);

    const from = fromReturning([
      {
        payload: profile(90).nutrition,
        client_updated_at: 5000,
        server_updated_at: "2026-02-01T00:00:00Z",
        deleted_at: null,
      },
    ]);
    const client = authenticatedClient({ from });

    const result = await pullProfile(client, tracker, local);

    // `remote` reflete o mapeamento real de `pullProfile` (createdAt ==
    // updatedAt == client_updated_at) — não a convenção do helper `profile`
    // local, que fixa createdAt em 1000 de propósito para os outros testes.
    expect(result).toEqual({
      status: "conflict",
      local: profile(70),
      remote: { ...profile(90, 5000), createdAt: 5000 },
    });
    const stillLocal = await local.get();
    expect(stillLocal?.nutrition.weightKg).toBe(70);
    expect((await tracker.get("profile:me"))?.status).toBe("conflict");
  });

  it("reports pending-unpushed, not a conflict, when the local edit is pending but the server has not moved", async () => {
    await local.save(profile(70), null);
    await markPending(tracker, "profile", PROFILE_ID);

    const from = fromReturning([
      {
        payload: profile(70).nutrition,
        client_updated_at: 1000,
        server_updated_at: "2026-02-01T00:00:00Z",
        deleted_at: null,
      },
    ]);
    const client = authenticatedClient({ from });

    // Primeiro pull: servidor tem uma versão nova de verdade -> conflito,
    // mas isto só grava a versão do servidor conhecida. Para testar
    // "não mudou desde a última vez", simulamos o tracker já sabendo dessa
    // versão de antemão (como se um sync anterior já a tivesse visto).
    await tracker.put({
      id: "profile:me",
      store: "profile",
      recordId: PROFILE_ID,
      status: "pending",
      serverUpdatedAt: "2026-02-01T00:00:00Z",
      createdAt: 1,
      updatedAt: 1,
    });

    const result = await pullProfile(client, tracker, local);

    expect(result).toEqual({ status: "pending-unpushed" });
    // Nada foi tocado localmente.
    expect((await local.get())?.nutrition.weightKg).toBe(70);
  });

  it("rejects a malformed remote payload instead of writing it locally", async () => {
    const from = fromReturning([
      {
        payload: { sex: "not-a-real-sex" },
        client_updated_at: 5000,
        server_updated_at: "2026-02-01T00:00:00Z",
        deleted_at: null,
      },
    ]);
    const client = authenticatedClient({ from });

    const result = await pullProfile(client, tracker, local);

    expect(result).toEqual({ status: "invalid-payload" });
    expect(await local.get()).toBeUndefined();
  });

  it("treats a tombstoned remote row as no remote data", async () => {
    const from = fromReturning([
      {
        payload: profile().nutrition,
        client_updated_at: 5000,
        server_updated_at: "2026-02-01T00:00:00Z",
        deleted_at: "2026-02-02T00:00:00Z",
      },
    ]);
    const client = authenticatedClient({ from });

    const result = await pullProfile(client, tracker, local);

    expect(result).toEqual({ status: "no-remote-data" });
  });
});
