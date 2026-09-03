import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalRoutineRepository, ROUTINES_STORE } from "@/features/workouts/data/routine-repository";
import type { Routine } from "@/features/workouts/types/routine";

import { pullAllRoutines, pushAllRoutines, resolveRoutineConflict } from "./routine-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Orquestração real de push/pull/resolve para `Routine` — mesmo formato de
 * `diet-sync.test.ts`, a mesma família de problema (muitos registros por
 * usuário). `FakeServer` simulando push/pull de verdade, sem precisar do
 * Supabase real.
 */

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

function routine(id: string, overrides: Partial<Routine> = {}): Routine {
  return {
    id,
    name: overrides.name ?? id,
    notes: overrides.notes ?? "",
    exercises: overrides.exercises ?? [],
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
  };
}

interface ServerRow {
  id: string;
  payload: { name: string; notes: string; exercises: unknown };
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

  /** Espelha `save_routine` (migration 0025) — mesmas duas ramificações de `save_diet`. */
  save(
    id: string,
    payload: { name: string; notes: string; exercises: unknown },
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
      if (fn === "save_routine") {
        const result = server.save(
          args.p_id as string,
          args.p_payload as { name: string; notes: string; exercises: unknown },
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "delete_routine") {
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
  const local = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

async function setRoutine(dev: Device, r: Routine) {
  const current = await dev.local.getById(r.id);
  await dev.local.save(r, current?.updatedAt ?? null);
  await markPending(dev.tracker, "routines", r.id);
}

async function deleteRoutine(dev: Device, id: string) {
  await dev.local.remove(id);
  await markPending(dev.tracker, "routines", id);
}

async function sync(dev: Device) {
  const push = await pushAllRoutines(dev.client, dev.tracker, dev.local);
  const pull = await pullAllRoutines(dev.client, dev.tracker, dev.local);
  return { push, pull };
}

describe("push/pullAllRoutines — orquestração", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. uma rotina pendente sobe e volta aplicada", async () => {
    const a = device(server);
    await setRoutine(a, routine("rotina-1", { name: "Push" }));

    expect(await pushAllRoutines(a.client, a.tracker, a.local)).toEqual({
      status: "done",
      pushed: ["rotina-1"],
      conflicts: [],
      errors: [],
    });
    expect(await pullAllRoutines(a.client, a.tracker, a.local)).toEqual({
      status: "done",
      conflicts: [],
      invalid: [],
    });
  });

  it("2. duas rotinas locais, só uma pendente: só ela sobe", async () => {
    const a = device(server);
    await setRoutine(a, routine("rotina-1"));
    await sync(a);

    await setRoutine(a, routine("rotina-2"));
    const push = await pushAllRoutines(a.client, a.tracker, a.local);
    expect(push).toMatchObject({ status: "done", pushed: ["rotina-2"] });
    expect(server.allRows().map((r) => r.id).sort()).toEqual(["rotina-1", "rotina-2"]);
  });

  it("3. rotina nova de outro dispositivo aparece no pull sem nunca ter sido pedida por id", async () => {
    const a = device(server);
    const b = device(server);

    await setRoutine(a, routine("rotina-1", { name: "Pull" }));
    await sync(a);

    const pull = await pullAllRoutines(b.client, b.tracker, b.local);
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });

    const bRoutine = await b.local.getById("rotina-1");
    expect(bRoutine?.name).toBe("Pull");
  });

  it("4. A apaga, B edita a mesma rotina: conflito de exclusão-vs-edição, nenhum lado é aplicado sozinho", async () => {
    const a = device(server);
    const b = device(server);

    await setRoutine(a, routine("rotina-1", { name: "Original" }));
    await sync(a);
    await sync(b); // B fica sabendo da rotina.

    await deleteRoutine(a, "rotina-1");
    await sync(a);

    await setRoutine(b, routine("rotina-1", { name: "Editada por B" }));
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({
      routineId: "rotina-1",
      remote: null, // A apagou.
    });
    expect(pull.conflicts[0]?.local?.name).toBe("Editada por B");

    // A edição de B sobrevive local — o pull não a descartou.
    expect((await b.local.getById("rotina-1"))?.name).toBe("Editada por B");
  });

  it("5. repetir push/pull várias vezes não duplica nem corrompe nada", async () => {
    const a = device(server);
    await setRoutine(a, routine("rotina-1"));
    await sync(a);

    for (let i = 0; i < 4; i += 1) {
      const { push, pull } = await sync(a);
      expect(push).toEqual({ status: "nothing-pending" });
      expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    }

    expect(await a.local.listAll()).toHaveLength(1);
  });

  it("6. rotina apagada localmente antes de qualquer sync não chama a rede, só limpa a pendência", async () => {
    const a = device(server);
    await setRoutine(a, routine("rotina-1"));
    await deleteRoutine(a, "rotina-1"); // Nunca chegou a subir.

    const push = await pushAllRoutines(a.client, a.tracker, a.local);
    expect(push).toEqual({ status: "done", pushed: ["rotina-1"], conflicts: [], errors: [] });
    expect(server.allRows()).toHaveLength(0);
  });

  it("7. resolver o conflito 'manter local' reenvia a edição; 'usar servidor' aplica a exclusão", async () => {
    const a = device(server);
    const b = device(server);

    await setRoutine(a, routine("rotina-1", { name: "Original" }));
    await sync(a);
    await sync(b);

    await deleteRoutine(a, "rotina-1");
    await sync(a);

    await setRoutine(b, routine("rotina-1", { name: "Editada por B" }));
    const { pull } = await sync(b);
    if (pull.status !== "done") throw new Error("unreachable");
    const conflict = pull.conflicts[0];
    if (conflict === undefined) throw new Error("esperava um conflito");

    await resolveRoutineConflict(b.tracker, b.local, conflict.routineId, "keep-local", conflict.remote);
    const resolved = await sync(b);
    expect(resolved.push).toMatchObject({ status: "done", pushed: ["rotina-1"] });
    expect(server.allRows().find((r) => r.id === "rotina-1")?.deletedAt).toBeNull();
  });

  it("7b. resolver 'usar servidor' aplica a exclusão remota, descartando a edição local", async () => {
    const a = device(server);
    const b = device(server);

    await setRoutine(a, routine("rotina-1", { name: "Original" }));
    await sync(a);
    await sync(b);

    await deleteRoutine(a, "rotina-1");
    await sync(a);

    await setRoutine(b, routine("rotina-1", { name: "Editada por B" }));
    const { pull } = await sync(b);
    if (pull.status !== "done") throw new Error("unreachable");
    const conflict = pull.conflicts[0];
    if (conflict === undefined) throw new Error("esperava um conflito");

    await resolveRoutineConflict(b.tracker, b.local, conflict.routineId, "use-server", conflict.remote);
    expect(await b.local.getById("rotina-1")).toBeUndefined();
    expect(await pushAllRoutines(b.client, b.tracker, b.local)).toEqual({
      status: "nothing-pending",
    });
  });

  /** Achado de auditoria de design (03/09/2026) — mesmo bug do `BodyEntry`. */
  it("8. BUG: dois dispositivos criam a mesma rotina (mesmo treino) sem nunca ter sincronizado — zero conflito", async () => {
    const a = device(server);
    const b = device(server);

    await setRoutine(a, routine("rotina-1", { name: "Treino A", notes: "foco em peito" }));
    await sync(a);

    await setRoutine(b, routine("rotina-1", { name: "Treino A", notes: "foco em peito" }));
    const { pull } = await sync(b);

    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await b.local.getById("rotina-1"))?.name).toBe("Treino A");
  });

  it("9. mesmo cenário, mas com uma alteração real — conflito real", async () => {
    const a = device(server);
    const b = device(server);

    await setRoutine(a, routine("rotina-1", { name: "Treino A" }));
    await sync(a);

    await setRoutine(b, routine("rotina-1", { name: "Treino A (editado)" }));
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
  });
});
