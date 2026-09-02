import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalSessionRepository, SESSIONS_STORE } from "@/features/workouts/data/session-repository";
import type { Session } from "@/features/workouts/types/session";

import { pullAllSessions, pushAllSessions, resolveSessionConflict } from "./session-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Ataque adversarial ao motor de sync de `Session` com dois dispositivos de
 * verdade — mesmo pedido de sempre (`routine-sync.adversarial.test.ts`): não
 * é fuzzing, é tentar quebrar as garantias reais com cenários realistas.
 *
 * Duas coisas para atacar de propósito, além da lista padrão herdada de
 * `Diet`/`Routine`: primeiro, o cenário 11 (duas exclusões concorrentes sem
 * nunca ter puxado uma da outra), repetido porque "o código é uma cópia" não
 * é prova de que o comportamento também é. Segundo — e este é o de verdade
 * novo aqui — o portão de `finishedAt`: cenários 13-16 tentam ativamente
 * fazer uma sessão em andamento vazar para o servidor, de todo jeito que a
 * API deste módulo permite tentar.
 */

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

function session(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    routineId: overrides.routineId ?? null,
    name: overrides.name ?? id,
    startedAt: overrides.startedAt ?? 1000,
    finishedAt: "finishedAt" in overrides ? (overrides.finishedAt ?? null) : 2000,
    exercises: overrides.exercises ?? [],
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 2000,
  };
}

interface ServerRow {
  id: string;
  routineId: string | null;
  name: string;
  startedAt: number;
  finishedAt: number;
  payload: { exercises: unknown };
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

/** Mesma disciplina de duas ramificações da migration real, e a mesma recusa de `finishedAt === null`. */
class FakeServer {
  #rows = new Map<string, ServerRow>();
  #clock = 0;

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-08-25T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

  save(
    id: string,
    routineId: string | null,
    name: string,
    startedAt: number,
    finishedAt: number | null,
    payload: { exercises: unknown },
    clientUpdatedAt: number,
    expected: string | null,
  ): { server_updated_at: string; applied: boolean } {
    if (finishedAt === null) {
      throw new Error("workout_sessions only sync once finished");
    }
    const row = this.#rows.get(id);

    if (expected === null) {
      if (row === undefined || row.deletedAt !== null) {
        const serverUpdatedAt = this.#nextTimestamp();
        this.#rows.set(id, {
          id,
          routineId,
          name,
          startedAt,
          finishedAt,
          payload,
          clientUpdatedAt,
          serverUpdatedAt,
          deletedAt: null,
        });
        return { server_updated_at: serverUpdatedAt, applied: true };
      }
      return { server_updated_at: row.serverUpdatedAt, applied: false };
    }

    if (row === undefined || row.serverUpdatedAt !== expected) {
      return { server_updated_at: row?.serverUpdatedAt ?? expected, applied: false };
    }
    const serverUpdatedAt = this.#nextTimestamp();
    this.#rows.set(id, {
      id,
      routineId,
      name,
      startedAt,
      finishedAt,
      payload,
      clientUpdatedAt,
      serverUpdatedAt,
      deletedAt: null,
    });
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
      if (fn === "save_workout_session") {
        const result = server.save(
          args.p_id as string,
          args.p_routine_id as string | null,
          args.p_name as string,
          args.p_started_at as number,
          args.p_finished_at as number | null,
          args.p_payload as { exercises: unknown },
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "delete_workout_session") {
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
            routine_id: row.routineId,
            name: row.name,
            started_at: row.startedAt,
            finished_at: row.finishedAt,
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
  const local = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

/** Só marca pendente quando `finishedAt !== null` — a disciplina real vive em `SyncingSessionRepository`; aqui replicamos só o suficiente para montar cada cenário. */
async function editLocally(dev: Device, id: string, overrides: Partial<Session> = {}) {
  const current = await dev.local.getById(id);
  const s = session(id, overrides);
  await dev.local.save(s, current?.updatedAt ?? null);
  if (s.finishedAt !== null) {
    await markPending(dev.tracker, "sessions", id);
  }
}

async function deleteLocally(dev: Device, id: string) {
  await dev.local.remove(id);
  await markPending(dev.tracker, "sessions", id);
}

async function sync(dev: Device) {
  const push = await pushAllSessions(dev.client, dev.tracker, dev.local);
  const pull = await pullAllSessions(dev.client, dev.tracker, dev.local);
  return { push, pull };
}

describe("motor de sync de Session — ataque adversarial", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. PC finaliza uma sessão, celular sincroniza e recebe", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "sessao-1", { name: "Push", finishedAt: 2000 });
    await sync(pc);
    await sync(celular);

    expect((await celular.local.getById("sessao-1"))?.name).toBe("Push");
  });

  it("2. celular finaliza, PC sincroniza (sentido oposto do 1)", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(celular, "sessao-1", { name: "Pull", finishedAt: 2000 });
    await sync(celular);
    await sync(pc);

    expect((await pc.local.getById("sessao-1"))?.name).toBe("Pull");
  });

  it("3. offline: edita várias vezes depois de finalizada, só sincroniza no final", async () => {
    const pc = device(server);
    await editLocally(pc, "sessao-1", { name: "v1", finishedAt: 2000 });
    await editLocally(pc, "sessao-1", { name: "v2", finishedAt: 2000 });
    await editLocally(pc, "sessao-1", { name: "v3", finishedAt: 2000 });
    expect((await pc.tracker.get("sessions:sessao-1"))?.status).toBe("pending");

    expect(await pushAllSessions(pc.client, pc.tracker, pc.local)).toMatchObject({
      status: "done",
      pushed: ["sessao-1"],
    });
    expect(server.row("sessao-1")?.name).toBe("v3");
  });

  it("4. dois dispositivos editam a MESMA sessão finalizada ao mesmo tempo: o segundo push vira conflito bloqueado, nunca sobrescreve", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "sessao-1", { name: "Do PC", finishedAt: 2000 });
    await editLocally(celular, "sessao-1", { name: "Do celular", finishedAt: 2000 });

    expect(await pushAllSessions(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["sessao-1"],
    });

    const celularPush = await pushAllSessions(celular.client, celular.tracker, celular.local);
    expect(celularPush).toMatchObject({ status: "done", conflicts: ["sessao-1"] });

    expect((await celular.local.getById("sessao-1"))?.name).toBe("Do celular");
    expect((await celular.tracker.get("sessions:sessao-1"))?.status).toBe("conflict");
    expect(server.row("sessao-1")?.name).toBe("Do PC");
  });

  it("5. A tem edição local pendente e recebe uma edição de B via pull — bloqueia até resolução explícita", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, "sessao-1", { name: "De B", finishedAt: 2000 });
    await sync(b);

    await editLocally(a, "sessao-1", { name: "De A, sem saber de B", finishedAt: 2000 });
    const { pull } = await sync(a);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toEqual([
      {
        sessionId: "sessao-1",
        local: expect.objectContaining({ name: "De A, sem saber de B" }),
        remote: expect.objectContaining({ name: "De B" }),
      },
    ]);

    await resolveSessionConflict(a.tracker, a.local, "sessao-1", "keep-local", pull.conflicts[0]?.remote ?? null);
    expect(await pushAllSessions(a.client, a.tracker, a.local)).toMatchObject({
      pushed: ["sessao-1"],
    });
    expect(server.row("sessao-1")?.name).toBe("De A, sem saber de B");
  });

  it("6. queda de rede durante o push: a pendência local sobrevive intacta, retry funciona", async () => {
    const pc = device(server);
    await editLocally(pc, "sessao-1", { name: "v1", finishedAt: 2000 });

    const failing = deviceClient(server, { rpc: vi.fn().mockRejectedValue(new Error("net down")) });
    await expect(pushAllSessions(failing, pc.tracker, pc.local)).rejects.toThrow("net down");

    expect((await pc.tracker.get("sessions:sessao-1"))?.status).toBe("pending");
    expect(server.allRows()).toHaveLength(0);

    expect(await pushAllSessions(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["sessao-1"],
    });
  });

  it("7. push aplicado, mas o pull seguinte falha: o que já foi enviado continua de pé", async () => {
    const pc = device(server);
    await editLocally(pc, "sessao-1", { name: "v1", finishedAt: 2000 });
    expect(await pushAllSessions(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["sessao-1"],
    });

    const brokenPull = deviceClient(server, {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(
          chainableEqLazy(() => ({ data: null, error: { message: "connection reset" } })),
        ),
      }),
    });
    expect(await pullAllSessions(brokenPull, pc.tracker, pc.local)).toEqual({
      status: "error",
      message: "connection reset",
    });

    expect((await pc.tracker.get("sessions:sessao-1"))?.status).toBe("clean");
  });

  it("8. pull traz dado novo, mas a gravação local falha: não marca como sincronizado, permite retry", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, "sessao-1", { name: "De B", finishedAt: 2000 });
    await sync(b);

    const brokenLocal = {
      listAll: () => a.local.listAll(),
      findInProgress: () => a.local.findInProgress(),
      getById: (id: string) => a.local.getById(id),
      remove: (id: string) => a.local.remove(id),
      save: vi.fn().mockRejectedValue(new Error("IndexedDB quota exceeded")),
    };
    await expect(pullAllSessions(a.client, a.tracker, brokenLocal)).rejects.toThrow(
      "IndexedDB quota exceeded",
    );
    expect((await a.tracker.get("sessions:sessao-1"))?.serverUpdatedAt).toBeUndefined();

    const retry = await pullAllSessions(a.client, a.tracker, a.local);
    expect(retry).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await a.local.getById("sessao-1"))?.name).toBe("De B");
  });

  it("9/10 (idempotência). repetir sync várias vezes não duplica nem diverge", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "sessao-1", { name: "v1", finishedAt: 2000 });
    await sync(a);
    await sync(b);

    for (let i = 0; i < 4; i += 1) {
      const resultA = await sync(a);
      const resultB = await sync(b);
      expect(resultA.push).toMatchObject({ status: "nothing-pending" });
      expect(resultB.push).toMatchObject({ status: "nothing-pending" });
    }

    expect(await a.local.listAll()).toHaveLength(1);
    expect((await a.tracker.getAll()).filter((t) => t.store === "sessions")).toHaveLength(1);
  });

  it("11. as duas apagam a mesma sessão sem nunca ter puxado uma da outra: o push perde a corrida (esperado), mas o pull seguinte converge sozinho", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "sessao-1", { name: "Original", finishedAt: 2000 });
    await sync(a);
    await sync(b);

    await deleteLocally(a, "sessao-1");
    await sync(a);

    await deleteLocally(b, "sessao-1");
    const { push, pull } = await sync(b);

    expect(push).toMatchObject({ status: "done", conflicts: ["sessao-1"] });
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await b.tracker.get("sessions:sessao-1"))?.status).toBe("clean");
    expect(await b.local.getById("sessao-1")).toBeUndefined();
  });

  it("12. exclusão + edição concorrente vira conflito visível, não aplica nenhum lado sozinho", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "sessao-1", { name: "Original", finishedAt: 2000 });
    await sync(a);
    await sync(b);

    await deleteLocally(a, "sessao-1");
    await editLocally(b, "sessao-1", { name: "Editada por B", finishedAt: 2000 });

    await sync(a);
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ sessionId: "sessao-1", remote: null });
  });

  it("13. sessão em andamento salva repetidas vezes (uma por série concluída) nunca aparece pendente nem chama a rede", async () => {
    const pc = device(server);

    for (let i = 0; i < 6; i += 1) {
      await editLocally(pc, "sessao-1", { name: `série ${i}`, finishedAt: null });
    }

    expect((await pc.tracker.get("sessions:sessao-1"))).toBeUndefined();
    expect(await pushAllSessions(pc.client, pc.tracker, pc.local)).toEqual({
      status: "nothing-pending",
    });
    expect(server.allRows()).toHaveLength(0);
  });

  it("14. dois dispositivos com sessões em andamento diferentes, nenhuma nunca sobe nem interfere na outra", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "sessao-pc", { name: "No PC", finishedAt: null });
    await editLocally(celular, "sessao-celular", { name: "No celular", finishedAt: null });

    await sync(pc);
    await sync(celular);

    expect(server.allRows()).toHaveLength(0);
    expect(await pc.local.getById("sessao-celular")).toBeUndefined();
    expect(await celular.local.getById("sessao-pc")).toBeUndefined();
  });

  it("15. mesmo se algo marcar pendente uma sessão em andamento por engano, pushOneSession recusa e pula — nunca chama a RPC que o servidor rejeitaria", async () => {
    const pc = device(server);
    await pc.local.save(session("sessao-1", { finishedAt: null }), null);
    // Simula um bug hipotético em outra camada que marcasse pendente mesmo
    // assim — a defesa em profundidade em `pushOneSession` tem que segurar
    // sozinha, sem depender de `SyncingSessionRepository` ter feito certo.
    await markPending(pc.tracker, "sessions", "sessao-1");

    const result = await pushAllSessions(pc.client, pc.tracker, pc.local);
    expect(result).toEqual({ status: "done", pushed: [], conflicts: [], errors: [] });
    expect(pc.client.rpc).not.toHaveBeenCalledWith(
      "save_workout_session",
      expect.anything(),
    );
    expect(server.allRows()).toHaveLength(0);
  });

  it("16. finalizar a sessão depois do 'vazamento' do cenário 15 não deixa nenhum resíduo — sobe normalmente na próxima chamada", async () => {
    const pc = device(server);
    await pc.local.save(session("sessao-1", { finishedAt: null }), null);
    await markPending(pc.tracker, "sessions", "sessao-1");
    await pushAllSessions(pc.client, pc.tracker, pc.local); // Pulada — cenário 15.

    await editLocally(pc, "sessao-1", { name: "Finalizada", finishedAt: 9000 });
    expect(await pushAllSessions(pc.client, pc.tracker, pc.local)).toMatchObject({
      status: "done",
      pushed: ["sessao-1"],
    });
    expect(server.row("sessao-1")?.name).toBe("Finalizada");
  });
});
