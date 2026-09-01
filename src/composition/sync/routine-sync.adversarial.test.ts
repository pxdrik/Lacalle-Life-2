import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalRoutineRepository, ROUTINES_STORE } from "@/features/workouts/data/routine-repository";
import type { Routine } from "@/features/workouts/types/routine";

import { pullAllRoutines, pushAllRoutines, resolveRoutineConflict } from "./routine-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Ataque adversarial ao motor de sync de `Routine` com dois dispositivos de
 * verdade — mesmo pedido de sempre (`diet-sync.adversarial.test.ts`): não é
 * fuzzing, é tentar quebrar as garantias reais com cenários realistas.
 *
 * `routine-sync.ts` nasceu como um porte quase direto de `diet-sync.ts` —
 * mas "o código é uma cópia" não é prova de que o comportamento também é;
 * o cenário 11 abaixo repete deliberadamente o ataque que achou um bug real
 * em `Diet` (dois dispositivos apagando o mesmo registro sem nunca ter
 * puxado um do outro) para confirmar que a correção portada realmente
 * segura o mesmo caso aqui, em vez de presumir que copiar a estrutura
 * copiou a correção.
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

/** Mesma lógica de duas ramificações da migration real — ver a doc em `routine-sync.test.ts`. */
class FakeServer {
  #rows = new Map<string, ServerRow>();
  #clock = 0;

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-08-25T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

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

  row(id: string): ServerRow | undefined {
    return this.#rows.get(id);
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
    ...overrides,
  };
}

function device(server: FakeServer) {
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  const local = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

async function editLocally(dev: Device, id: string, name: string) {
  const current = await dev.local.getById(id);
  await dev.local.save(routine(id, { name }), current?.updatedAt ?? null);
  await markPending(dev.tracker, "routines", id);
}

async function deleteLocally(dev: Device, id: string) {
  await dev.local.remove(id);
  await markPending(dev.tracker, "routines", id);
}

async function sync(dev: Device) {
  const push = await pushAllRoutines(dev.client, dev.tracker, dev.local);
  const pull = await pullAllRoutines(dev.client, dev.tracker, dev.local);
  return { push, pull };
}

describe("motor de sync de Routine — ataque adversarial", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. PC cria uma rotina, celular sincroniza e recebe", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "rotina-1", "Push");
    await sync(pc);
    await sync(celular);

    expect((await celular.local.getById("rotina-1"))?.name).toBe("Push");
  });

  it("2. celular cria, PC sincroniza (sentido oposto do 1)", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(celular, "rotina-1", "Pull");
    await sync(celular);
    await sync(pc);

    expect((await pc.local.getById("rotina-1"))?.name).toBe("Pull");
  });

  it("3. offline: edita várias vezes, só sincroniza no final — sem limite de tempo na pendência", async () => {
    const pc = device(server);
    await editLocally(pc, "rotina-1", "v1");
    await editLocally(pc, "rotina-1", "v2");
    await editLocally(pc, "rotina-1", "v3");
    expect((await pc.tracker.get("routines:rotina-1"))?.status).toBe("pending");

    expect(await pushAllRoutines(pc.client, pc.tracker, pc.local)).toMatchObject({
      status: "done",
      pushed: ["rotina-1"],
    });
    expect(server.row("rotina-1")?.payload.name).toBe("v3");
  });

  it("4. dois dispositivos editam a MESMA rotina ao mesmo tempo: o segundo push vira conflito bloqueado, nunca sobrescreve", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "rotina-1", "Do PC");
    await editLocally(celular, "rotina-1", "Do celular");

    expect(await pushAllRoutines(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["rotina-1"],
    });

    const celularPush = await pushAllRoutines(celular.client, celular.tracker, celular.local);
    expect(celularPush).toMatchObject({ status: "done", conflicts: ["rotina-1"] });

    expect((await celular.local.getById("rotina-1"))?.name).toBe("Do celular");
    expect((await celular.tracker.get("routines:rotina-1"))?.status).toBe("conflict");
    expect(server.row("rotina-1")?.payload.name).toBe("Do PC");

    expect(await pushAllRoutines(celular.client, celular.tracker, celular.local)).toEqual({
      status: "nothing-pending",
    });
  });

  it("5. A tem edição local pendente e recebe uma edição de B via pull — bloqueia até resolução explícita", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, "rotina-1", "De B");
    await sync(b);

    await editLocally(a, "rotina-1", "De A, sem saber de B");
    const { pull } = await sync(a);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toEqual([
      {
        routineId: "rotina-1",
        local: expect.objectContaining({ name: "De A, sem saber de B" }),
        remote: expect.objectContaining({ name: "De B" }),
      },
    ]);
    expect((await a.local.getById("rotina-1"))?.name).toBe("De A, sem saber de B");
    expect((await a.tracker.get("routines:rotina-1"))?.status).toBe("conflict");

    await resolveRoutineConflict(a.tracker, a.local, "rotina-1", "keep-local", pull.conflicts[0]?.remote ?? null);
    expect((await a.tracker.get("routines:rotina-1"))?.status).toBe("pending");
    expect(await pushAllRoutines(a.client, a.tracker, a.local)).toMatchObject({
      pushed: ["rotina-1"],
    });
    expect(server.row("rotina-1")?.payload.name).toBe("De A, sem saber de B");
  });

  it("6. queda de rede durante o push: a pendência local sobrevive intacta, retry funciona", async () => {
    const pc = device(server);
    await editLocally(pc, "rotina-1", "v1");

    const failing = deviceClient(server, { rpc: vi.fn().mockRejectedValue(new Error("net down")) });
    await expect(pushAllRoutines(failing, pc.tracker, pc.local)).rejects.toThrow("net down");

    expect((await pc.tracker.get("routines:rotina-1"))?.status).toBe("pending");
    expect((await pc.local.getById("rotina-1"))?.name).toBe("v1");
    expect(server.allRows()).toHaveLength(0);

    expect(await pushAllRoutines(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["rotina-1"],
    });
  });

  it("7. push aplicado, mas o pull seguinte falha: o que já foi enviado continua de pé", async () => {
    const pc = device(server);
    await editLocally(pc, "rotina-1", "v1");
    expect(await pushAllRoutines(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["rotina-1"],
    });

    const brokenPull = deviceClient(server, {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(
          chainableEqLazy(() => ({ data: null, error: { message: "connection reset" } })),
        ),
      }),
    });
    expect(await pullAllRoutines(brokenPull, pc.tracker, pc.local)).toEqual({
      status: "error",
      message: "connection reset",
    });

    expect((await pc.tracker.get("routines:rotina-1"))?.status).toBe("clean");
    expect((await pc.local.getById("rotina-1"))?.name).toBe("v1");
  });

  it("8. pull traz dado novo, mas a gravação local falha: não marca como sincronizado, permite retry", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, "rotina-1", "De B");
    await sync(b);

    const brokenLocal = {
      listAll: () => a.local.listAll(),
      getById: (id: string) => a.local.getById(id),
      remove: (id: string) => a.local.remove(id),
      save: vi.fn().mockRejectedValue(new Error("IndexedDB quota exceeded")),
    };
    await expect(pullAllRoutines(a.client, a.tracker, brokenLocal)).rejects.toThrow(
      "IndexedDB quota exceeded",
    );
    expect((await a.tracker.get("routines:rotina-1"))?.serverUpdatedAt).toBeUndefined();

    const retry = await pullAllRoutines(a.client, a.tracker, a.local);
    expect(retry).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await a.local.getById("rotina-1"))?.name).toBe("De B");
  });

  it("9/10 (idempotência). repetir sync várias vezes não duplica nem diverge", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "rotina-1", "v1");
    await sync(a);
    await sync(b);

    for (let i = 0; i < 4; i += 1) {
      const resultA = await sync(a);
      const resultB = await sync(b);
      expect(resultA.push).toMatchObject({ status: "nothing-pending" });
      expect(resultB.push).toMatchObject({ status: "nothing-pending" });
    }

    expect(await a.local.listAll()).toHaveLength(1);
    expect(await b.local.listAll()).toHaveLength(1);
    expect((await a.tracker.getAll()).filter((t) => t.store === "routines")).toHaveLength(1);
  });

  it("10. uma rotina em conflito não bloqueia o push/pull de uma rotina vizinha sem conflito, na mesma chamada", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "rotina-conflito", "Original");
    await editLocally(a, "rotina-tranquila", "Sem drama");
    await sync(a);
    await sync(b);

    await editLocally(a, "rotina-conflito", "Editada por A");
    await editLocally(a, "rotina-tranquila", "Também editada por A");
    await sync(a);

    await editLocally(b, "rotina-conflito", "Editada por B");
    const { push, pull } = await sync(b);

    expect(push).toMatchObject({ status: "done", conflicts: ["rotina-conflito"] });
    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts.map((c) => c.routineId)).toEqual(["rotina-conflito"]);
    expect((await b.local.getById("rotina-tranquila"))?.name).toBe("Também editada por A");
    expect((await b.tracker.get("routines:rotina-tranquila"))?.status).toBe("clean");
  });

  it("11. as duas apagam a mesma rotina sem nunca ter puxado uma da outra: o push perde a corrida (esperado, §22.3), mas o pull seguinte converge sozinho — nunca fica pedindo resolução para algo que já está resolvido", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "rotina-1", "Original");
    await sync(a);
    await sync(b);

    await deleteLocally(a, "rotina-1");
    await sync(a);

    // B nunca soube da exclusão de A — apaga por conta própria, com uma
    // versão esperada desatualizada. Repete deliberadamente o ataque que
    // achou o bug real em Diet: confirma que a correção portada
    // (`currentLocal !== undefined` decide o conflito, não o status do
    // tracker sozinho) realmente segura aqui, não só porque o código foi
    // copiado da mesma forma.
    await deleteLocally(b, "rotina-1");
    const { push, pull } = await sync(b);

    expect(push).toMatchObject({ status: "done", conflicts: ["rotina-1"] });
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await b.tracker.get("routines:rotina-1"))?.status).toBe("clean");
    expect(await b.local.getById("rotina-1")).toBeUndefined();
  });

  it("12a. exclusão + edição concorrente, A apaga e sincroniza primeiro: resultado é conflito", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "rotina-1", "Original");
    await sync(a);
    await sync(b);

    await deleteLocally(a, "rotina-1");
    await editLocally(b, "rotina-1", "Editada por B");

    await sync(a);
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ routineId: "rotina-1", remote: null });
  });

  it("12b. exclusão + edição concorrente, B sincroniza primeiro: mesmo resultado do 12a (determinístico)", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "rotina-1", "Original");
    await sync(a);
    await sync(b);

    await deleteLocally(a, "rotina-1");
    await editLocally(b, "rotina-1", "Editada por B");

    await sync(b); // Ordem invertida em relação ao 12a.
    const { pull } = await sync(a);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ routineId: "rotina-1", local: null });
  });
});
