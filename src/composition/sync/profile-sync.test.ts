import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";

import { pullProfile, pushProfile } from "./profile-sync";
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
    expect(entry?.pendingPush).toBe(false);
    expect(entry?.serverUpdatedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("reports a conflict without clearing the pending flag when applied is false", async () => {
    await local.save(profile(), null);
    await markPending(tracker, "profile", PROFILE_ID);

    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ server_updated_at: "2026-06-01T00:00:00Z", applied: false }], error: null });
    const client = authenticatedClient({ rpc });

    const result = await pushProfile(client, tracker, local);

    expect(result).toEqual({ status: "conflict" });
    const entry = await tracker.get("profile:me");
    // Continua pendente — a edição local não foi perdida, só não subiu ainda.
    expect(entry?.pendingPush).toBe(true);
    // Mas a versão conhecida do servidor avançou, para o próximo push tentar
    // com o valor certo.
    expect(entry?.serverUpdatedAt).toBe("2026-06-01T00:00:00Z");
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

  it("never overwrites a local edit that has not been pushed yet", async () => {
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

    expect(result).toEqual({ status: "local-pending-conflict" });
    const stillLocal = await local.get();
    expect(stillLocal?.nutrition.weightKg).toBe(70);
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
