import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalDietRepository } from "@/features/diet/data/local-diet-repository";
import { DIETS_STORE } from "@/features/diet/data/diet-store";
import type { Diet } from "@/features/diet/types/diet";

import { pullAllDiets, pushAllDiets, resolveDietConflict } from "./diet-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Orquestração real de push/pull/resolve para `Diet` — a primeira entidade
 * com muitos registros por usuário (ver a doc de `pushAllDiets`/
 * `pullAllDiets` em `diet-sync.ts` sobre por quê isso muda a forma dos
 * resultados). Mesmo formato de `food-log-sync.test.ts`: `FakeServer`
 * simulando push/pull de verdade, sem precisar do Supabase real.
 */

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

function diet(id: string, overrides: Partial<Diet> = {}): Diet {
  return {
    id,
    name: overrides.name ?? id,
    meals: overrides.meals ?? [],
    weekdays: overrides.weekdays ?? [],
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
  };
}

interface ServerRow {
  id: string;
  payload: { name: string; meals: unknown; weekdays: unknown };
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

class FakeServer {
  #rows = new Map<string, ServerRow>();
  #clock = 0;

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-08-25T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

  /**
   * Espelha exatamente `save_diet` (migration 0024, duas ramificações por
   * `expected`, nenhuma delas olha `deleted_at` na cláusula de update —
   * só o `insert ... on conflict` de `expected === null` revive, e mesmo
   * assim só quando a linha existente já está apagada). Diferente do
   * `FakeServer` de `food-log-sync.test.ts`, que revive incondicionalmente
   * ao achar `deletedAt !== null`: aquela tabela usa upsert por chave
   * composta, esta usa as duas ramificações reais que a migration escreve.
   */
  save(
    id: string,
    payload: { name: string; meals: unknown; weekdays: unknown },
    clientUpdatedAt: number,
    expected: string | null,
  ): { server_updated_at: string; applied: boolean } {
    const row = this.#rows.get(id);

    if (expected === null) {
      if (row === undefined || row.deletedAt !== null) {
        const serverUpdatedAt = this.#nextTimestamp();
        this.#rows.set(id, { id, payload, clientUpdatedAt, serverUpdatedAt, deletedAt: null });
        return { server_updated_at: serverUpdatedAt, applied: true };
      }
      // Colisão de id com uma linha viva de outro registro — não aplica.
      return { server_updated_at: row.serverUpdatedAt, applied: false };
    }

    if (row === undefined || row.serverUpdatedAt !== expected) {
      return { server_updated_at: row?.serverUpdatedAt ?? expected, applied: false };
    }
    const serverUpdatedAt = this.#nextTimestamp();
    this.#rows.set(id, { id, payload, clientUpdatedAt, serverUpdatedAt, deletedAt: null });
    return { server_updated_at: serverUpdatedAt, applied: true };
  }

  delete(id: string, expected: string | null): { server_updated_at: string; applied: boolean } {
    const row = this.#rows.get(id);
    if (row === undefined) return { server_updated_at: this.#nextTimestamp(), applied: false };
    if (row.serverUpdatedAt !== expected) {
      return { server_updated_at: row.serverUpdatedAt, applied: false };
    }
    const serverUpdatedAt = this.#nextTimestamp();
    this.#rows.set(id, { ...row, serverUpdatedAt, deletedAt: serverUpdatedAt });
    return { server_updated_at: serverUpdatedAt, applied: true };
  }

  allRows(): readonly ServerRow[] {
    return [...this.#rows.values()];
  }
}

function deviceClient(server: FakeServer): SyncSupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "save_diet") {
        const result = server.save(
          args.p_id as string,
          args.p_payload as { name: string; meals: unknown; weekdays: unknown },
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "delete_diet") {
        const result = server.delete(
          args.p_id as string,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      throw new Error(`unexpected rpc in this fake: ${fn}`);
    }) as SyncSupabaseClient["rpc"],
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(
        chainableEqLazy(() => ({
          data: server.allRows().map((row) => ({
            id: row.id,
            payload: row.payload,
            client_updated_at: row.clientUpdatedAt,
            server_updated_at: row.serverUpdatedAt,
            deleted_at: row.deletedAt,
          })),
          error: null,
        })),
      ),
    }),
  };
}

function device(server: FakeServer) {
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  const local = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

async function setDiet(dev: Device, d: Diet) {
  const current = await dev.local.getById(d.id);
  await dev.local.save(d, current?.updatedAt ?? null);
  await markPending(dev.tracker, "diets", d.id);
}

async function deleteDiet(dev: Device, id: string) {
  await dev.local.remove(id);
  await markPending(dev.tracker, "diets", id);
}

async function sync(dev: Device) {
  const push = await pushAllDiets(dev.client, dev.tracker, dev.local);
  const pull = await pullAllDiets(dev.client, dev.tracker, dev.local);
  return { push, pull };
}

describe("push/pullAllDiets — orquestração", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. uma dieta pendente sobe e volta aplicada", async () => {
    const a = device(server);
    await setDiet(a, diet("dieta-1", { name: "Cutting" }));

    expect(await pushAllDiets(a.client, a.tracker, a.local)).toEqual({
      status: "done",
      pushed: ["dieta-1"],
      conflicts: [],
      errors: [],
    });
    expect(await pullAllDiets(a.client, a.tracker, a.local)).toEqual({
      status: "done",
      conflicts: [],
      invalid: [],
    });
  });

  it("2. duas dietas locais, só uma pendente: só ela sobe", async () => {
    const a = device(server);
    await setDiet(a, diet("dieta-1"));
    await sync(a);

    await setDiet(a, diet("dieta-2"));
    const push = await pushAllDiets(a.client, a.tracker, a.local);
    expect(push).toMatchObject({ status: "done", pushed: ["dieta-2"] });
    expect(server.allRows().map((r) => r.id).sort()).toEqual(["dieta-1", "dieta-2"]);
  });

  it("3. dieta nova de outro dispositivo aparece no pull sem nunca ter sido pedida por id", async () => {
    const a = device(server);
    const b = device(server);

    await setDiet(a, diet("dieta-1", { name: "Bulking" }));
    await sync(a);

    const pull = await pullAllDiets(b.client, b.tracker, b.local);
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });

    const bDiet = await b.local.getById("dieta-1");
    expect(bDiet?.name).toBe("Bulking");
  });

  it("4. A apaga, B edita a mesma dieta: conflito de exclusão-vs-edição, nenhum lado é aplicado sozinho", async () => {
    const a = device(server);
    const b = device(server);

    await setDiet(a, diet("dieta-1", { name: "Original" }));
    await sync(a);
    await sync(b); // B fica sabendo da dieta.

    await deleteDiet(a, "dieta-1");
    await sync(a);

    await setDiet(b, diet("dieta-1", { name: "Editada por B" }));
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({
      dietId: "dieta-1",
      remote: null, // A apagou.
    });
    expect(pull.conflicts[0]?.local?.name).toBe("Editada por B");

    // A edição de B sobrevive local — o pull não a descartou.
    expect((await b.local.getById("dieta-1"))?.name).toBe("Editada por B");
  });

  it("5. repetir push/pull várias vezes não duplica nem corrompe nada", async () => {
    const a = device(server);
    await setDiet(a, diet("dieta-1"));
    await sync(a);

    for (let i = 0; i < 4; i += 1) {
      const { push, pull } = await sync(a);
      expect(push).toEqual({ status: "nothing-pending" });
      expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    }

    expect(await a.local.listAll()).toHaveLength(1);
  });

  it("6. dieta apagada localmente antes de qualquer sync não chama a rede, só limpa a pendência", async () => {
    const a = device(server);
    await setDiet(a, diet("dieta-1"));
    await deleteDiet(a, "dieta-1"); // Nunca chegou a subir.

    const push = await pushAllDiets(a.client, a.tracker, a.local);
    expect(push).toEqual({ status: "done", pushed: ["dieta-1"], conflicts: [], errors: [] });
    expect(server.allRows()).toHaveLength(0);
  });

  it("7. resolver o conflito 'manter local' reenvia a edição; 'usar servidor' aplica a exclusão", async () => {
    const a = device(server);
    const b = device(server);

    await setDiet(a, diet("dieta-1", { name: "Original" }));
    await sync(a);
    await sync(b);

    await deleteDiet(a, "dieta-1");
    await sync(a);

    await setDiet(b, diet("dieta-1", { name: "Editada por B" }));
    const { pull } = await sync(b);
    if (pull.status !== "done") throw new Error("unreachable");
    const conflict = pull.conflicts[0];
    if (conflict === undefined) throw new Error("esperava um conflito");

    await resolveDietConflict(b.tracker, b.local, conflict.dietId, "keep-local", conflict.remote);
    const resolved = await sync(b);
    expect(resolved.push).toMatchObject({ status: "done", pushed: ["dieta-1"] });
    expect(server.allRows().find((r) => r.id === "dieta-1")?.deletedAt).toBeNull();
  });

  it("7b. resolver 'usar servidor' aplica a exclusão remota, descartando a edição local", async () => {
    const a = device(server);
    const b = device(server);

    await setDiet(a, diet("dieta-1", { name: "Original" }));
    await sync(a);
    await sync(b);

    await deleteDiet(a, "dieta-1");
    await sync(a);

    await setDiet(b, diet("dieta-1", { name: "Editada por B" }));
    const { pull } = await sync(b);
    if (pull.status !== "done") throw new Error("unreachable");
    const conflict = pull.conflicts[0];
    if (conflict === undefined) throw new Error("esperava um conflito");

    await resolveDietConflict(b.tracker, b.local, conflict.dietId, "use-server", conflict.remote);
    expect(await b.local.getById("dieta-1")).toBeUndefined();
    expect(await pushAllDiets(b.client, b.tracker, b.local)).toEqual({
      status: "nothing-pending",
    });
  });
});
