import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";

import { pullProfile, pushProfile } from "./profile-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";

/**
 * Ataque adversarial ao motor de sync do `Profile`, antes de generalizar o
 * padrão para as outras sete entidades — pedido explícito do Pedro depois
 * de ver o §21 funcionando: "se o Profile sobreviver a isso, aí sim temos
 * um motor que merece ser generalizado".
 *
 * Simula dois dispositivos reais (`deviceA`, `deviceB`) — cada um com seu
 * próprio IndexedDB (`MemoryStore` isolado) — contra um servidor fake que
 * reproduz fielmente o comportamento das RPCs reais (`applied`, revive de
 * tombstone, conflito por `server_updated_at`), sem precisar do Supabase de
 * verdade para provar a lógica. Os cenários que dependem de rede/dispositivo
 * real (1, 2, 5, 6) também foram confirmados com duas abas reais contra o
 * Supabase de produção — ver docs/arquitetura-sincronizacao.md §22.
 */

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

function profile(weightKg: number, updatedAt: number): Profile {
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
    createdAt: updatedAt,
    updatedAt,
  };
}

interface ServerRow {
  payload: unknown;
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

/**
 * Servidor fake compartilhado por todos os "dispositivos" de um teste.
 * Reproduz save_profile: cria se não existir, revive incondicionalmente se
 * tombstoned, ou aplica só se `expected` bater com a versão viva atual —
 * exatamente o `WHERE` das migrations reais (§20.4).
 */
class FakeServer {
  #row: ServerRow | undefined;
  #clock = 0;

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-08-25T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

  save(
    payload: unknown,
    clientUpdatedAt: number,
    expected: string | null,
  ): { server_updated_at: string; applied: boolean } {
    if (this.#row === undefined) {
      const serverUpdatedAt = this.#nextTimestamp();
      this.#row = { payload, clientUpdatedAt, serverUpdatedAt, deletedAt: null };
      return { server_updated_at: serverUpdatedAt, applied: true };
    }

    if (this.#row.deletedAt !== null) {
      const serverUpdatedAt = this.#nextTimestamp();
      this.#row = { payload, clientUpdatedAt, serverUpdatedAt, deletedAt: null };
      return { server_updated_at: serverUpdatedAt, applied: true };
    }

    if (this.#row.serverUpdatedAt !== expected) {
      return { server_updated_at: this.#row.serverUpdatedAt, applied: false };
    }

    const serverUpdatedAt = this.#nextTimestamp();
    this.#row = { payload, clientUpdatedAt, serverUpdatedAt, deletedAt: null };
    return { server_updated_at: serverUpdatedAt, applied: true };
  }

  currentRow(): ServerRow | undefined {
    return this.#row === undefined ? undefined : { ...this.#row };
  }
}

function deviceClient(
  server: FakeServer,
  overrides: Partial<SyncSupabaseClient> = {},
): SyncSupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
    rpc: (async (fn: string, args: Record<string, unknown>) => {
      if (fn === "save_profile") {
        const result = server.save(
          args.p_payload,
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      throw new Error(`unexpected rpc in this fake: ${fn}`);
    }) as SyncSupabaseClient["rpc"],
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn(async () => {
          const row = server.currentRow();
          if (row === undefined) return { data: [], error: null };
          return {
            data: [
              {
                payload: row.payload,
                client_updated_at: row.clientUpdatedAt,
                server_updated_at: row.serverUpdatedAt,
                deleted_at: row.deletedAt,
              },
            ],
            error: null,
          };
        }),
      }),
    }),
    ...overrides,
  };
}

function device(server: FakeServer) {
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  const local = new LocalProfileRepository(new MemoryStore<Profile>(PROFILE_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

async function editLocally(
  device: { local: LocalProfileRepository; tracker: MemoryStore<SyncTracker> },
  weightKg: number,
  at: number,
) {
  const current = await device.local.get();
  await device.local.save(profile(weightKg, at), current?.updatedAt ?? null);
  await markPending(device.tracker, "profile", PROFILE_ID);
}

describe("motor de sync do Profile — ataque adversarial", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. PC altera peso, celular sincroniza", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, 85, 1000);
    const push = await pushProfile(pc.client, pc.tracker, pc.local);
    expect(push).toEqual({ status: "pushed" });

    const pull = await pullProfile(celular.client, celular.tracker, celular.local);
    expect(pull).toEqual({ status: "applied" });
    expect((await celular.local.get())?.nutrition.weightKg).toBe(85);
  });

  it("2. celular altera peso, PC sincroniza (sentido oposto do 1)", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(celular, 90, 1000);
    expect(await pushProfile(celular.client, celular.tracker, celular.local)).toEqual({
      status: "pushed",
    });

    expect(await pullProfile(pc.client, pc.tracker, pc.local)).toEqual({
      status: "applied",
    });
    expect((await pc.local.get())?.nutrition.weightKg).toBe(90);
  });

  it("3. PC offline, altera, volta online e sincroniza", async () => {
    const pc = device(server);

    // "Offline": a edição fica só localmente, pendente, por tempo nenhum
    // limite algum na lógica — só não chamamos push ainda.
    await editLocally(pc, 82, 1000);
    const stillPending = await pc.tracker.get("profile:me");
    expect(stillPending?.pendingPush).toBe(true);

    // "Volta online": push roda mais tarde, sem nada ter mudado localmente.
    expect(await pushProfile(pc.client, pc.tracker, pc.local)).toEqual({
      status: "pushed",
    });
    expect((await pc.tracker.get("profile:me"))?.pendingPush).toBe(false);
  });

  it("4. celular offline, altera, volta online e sincroniza (simétrico ao 3)", async () => {
    const celular = device(server);

    await editLocally(celular, 68, 1000);
    expect((await celular.tracker.get("profile:me"))?.pendingPush).toBe(true);

    expect(await pushProfile(celular.client, celular.tracker, celular.local)).toEqual({
      status: "pushed",
    });
  });

  it("5. dois dispositivos alteram simultaneamente: o segundo push vira conflito, não sobrescreve", async () => {
    const pc = device(server);
    const celular = device(server);

    // Os dois partem do mesmo estado (nenhum ainda sincronizou).
    await editLocally(pc, 100, 1000);
    await editLocally(celular, 70, 1000);

    expect(await pushProfile(pc.client, pc.tracker, pc.local)).toEqual({
      status: "pushed",
    });

    const celularPush = await pushProfile(celular.client, celular.tracker, celular.local);
    expect(celularPush).toEqual({ status: "conflict" });

    // O conflito é visível (status "conflict"), e a edição do celular não
    // foi perdida nem sobrescrita — continua pendente, com o valor dele.
    expect((await celular.local.get())?.nutrition.weightKg).toBe(70);
    expect((await celular.tracker.get("profile:me"))?.pendingPush).toBe(true);

    // E o servidor continua com o valor do PC — o celular não teve poder de
    // sobrescrever silenciosamente.
    expect(server.currentRow()?.payload).toMatchObject({ weightKg: 100 });
  });

  it("6. dispositivo A tem edição local pendente e recebe uma edição de B via pull — não sobrescreve, mas o push seguinte pode sobrescrever B sem aviso (achado)", async () => {
    const a = device(server);
    const b = device(server);

    // B edita e sincroniza primeiro.
    await editLocally(b, 95, 1000);
    expect(await pushProfile(b.client, b.tracker, b.local)).toEqual({ status: "pushed" });

    // A, sem saber de B, edita localmente por conta própria.
    await editLocally(a, 60, 1000);

    const pull = await pullProfile(a.client, a.tracker, a.local);
    expect(pull).toEqual({ status: "local-pending-conflict" });
    // A edição local de A sobrevive — o pull não a apagou.
    expect((await a.local.get())?.nutrition.weightKg).toBe(60);

    // ACHADO: depois do "local-pending-conflict", a versão do servidor
    // conhecida por A já foi atualizada (markPulled), então se A simplesmente
    // tentar sincronizar de novo sem nenhuma resolução explícita de
    // conflito, o push agora bate com a versão esperada e SOBRESCREVE o
    // valor de B silenciosamente — exatamente o "last-write-wins silencioso"
    // que a arquitetura diz que a família Profile nunca deveria ter
    // (docs/arquitetura-sincronizacao.md §8.1/§16).
    const secondPush = await pushProfile(a.client, a.tracker, a.local);
    expect(secondPush).toEqual({ status: "pushed" });
    expect(server.currentRow()?.payload).toMatchObject({ weightKg: 60 });
  });

  it("7/10. perde conexão durante o push: a edição local pendente não é perdida nem corrompida", async () => {
    const pc = device(server);
    await editLocally(pc, 77, 1000);

    const failingClient = deviceClient(server, {
      rpc: vi.fn().mockRejectedValue(new Error("network down")),
    });

    await expect(pushProfile(failingClient, pc.tracker, pc.local)).rejects.toThrow(
      "network down",
    );

    // Nada foi corrompido: continua pendente, com o mesmo valor, e o
    // servidor nunca recebeu a escrita.
    expect((await pc.tracker.get("profile:me"))?.pendingPush).toBe(true);
    expect((await pc.local.get())?.nutrition.weightKg).toBe(77);
    expect(server.currentRow()).toBeUndefined();
  });

  it("8. reabre com outbox pendente: o retry usa o mesmo estado local e completa normalmente", async () => {
    const pc = device(server);
    await editLocally(pc, 77, 1000);

    const failingClient = deviceClient(server, {
      rpc: vi.fn().mockRejectedValue(new Error("network down")),
    });
    await expect(pushProfile(failingClient, pc.tracker, pc.local)).rejects.toThrow();

    // "Reabrir a aba" aqui é só usar os mesmos stores de novo — é
    // exatamente o que sobrevive a um reload de verdade, porque são
    // IndexedDB, não estado em memória do componente.
    const retryResult = await pushProfile(pc.client, pc.tracker, pc.local);
    expect(retryResult).toEqual({ status: "pushed" });
    expect((await pc.tracker.get("profile:me"))?.pendingPush).toBe(false);
  });

  it("11. push funciona, mas o pull seguinte falha: o push já aplicado continua válido", async () => {
    const pc = device(server);
    await editLocally(pc, 83, 1000);
    expect(await pushProfile(pc.client, pc.tracker, pc.local)).toEqual({
      status: "pushed",
    });

    const brokenPullClient = deviceClient(server, {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "connection reset" },
          }),
        }),
      }),
    });

    const pull = await pullProfile(brokenPullClient, pc.tracker, pc.local);
    expect(pull).toEqual({ status: "error", message: "connection reset" });

    // O push que já tinha sido aplicado continua de pé — uma falha no pull
    // seguinte não desfaz nada.
    expect((await pc.tracker.get("profile:me"))?.pendingPush).toBe(false);
    expect((await pc.local.get())?.nutrition.weightKg).toBe(83);
    expect(server.currentRow()?.payload).toMatchObject({ weightKg: 83 });
  });

  it("12. pull traz dado do servidor, mas a gravação local falha: não marca como sincronizado (permite retry)", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, 95, 1000);
    await pushProfile(b.client, b.tracker, b.local);

    const brokenLocal = {
      get: () => a.local.get(),
      save: vi.fn().mockRejectedValue(new Error("IndexedDB quota exceeded")),
      clear: () => a.local.clear(),
    };

    await expect(pullProfile(a.client, a.tracker, brokenLocal)).rejects.toThrow(
      "IndexedDB quota exceeded",
    );

    // markPulled nunca rodou: a versão do servidor conhecida continua nula,
    // então o próximo pull vai tentar de novo em vez de achar que já
    // sincronizou um dado que na verdade nunca foi gravado local.
    expect((await a.tracker.get("profile:me"))?.serverUpdatedAt).toBeUndefined();

    // E com o repositório local de verdade, o retry funciona normalmente.
    const retry = await pullProfile(a.client, a.tracker, a.local);
    expect(retry).toEqual({ status: "applied" });
    expect((await a.local.get())?.nutrition.weightKg).toBe(95);
  });

  it("13. repetir o mesmo sync várias vezes seguidas não duplica nem corrompe nada", async () => {
    const pc = device(server);
    await editLocally(pc, 80, 1000);
    expect(await pushProfile(pc.client, pc.tracker, pc.local)).toEqual({
      status: "pushed",
    });
    expect(await pullProfile(pc.client, pc.tracker, pc.local)).toEqual({
      status: "applied",
    });

    for (let i = 0; i < 5; i += 1) {
      expect(await pushProfile(pc.client, pc.tracker, pc.local)).toEqual({
        status: "nothing-pending",
      });
      expect(await pullProfile(pc.client, pc.tracker, pc.local)).toEqual({
        status: "applied",
      });
    }

    expect((await pc.local.get())?.nutrition.weightKg).toBe(80);
    expect(await pc.tracker.getAll()).toHaveLength(1);
  });
});
