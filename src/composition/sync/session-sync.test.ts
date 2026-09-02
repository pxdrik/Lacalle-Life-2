import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalSessionRepository, SESSIONS_STORE } from "@/features/workouts/data/session-repository";
import type { Session } from "@/features/workouts/types/session";

import { pullAllSessions, pushAllSessions, resolveSessionConflict } from "./session-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Orquestração real de push/pull/resolve para `Session` — mesmo formato de
 * `routine-sync.test.ts`, mesma família de "muitos registros por usuário",
 * mais a regra que só esta entidade tem: nada sincroniza antes de
 * `finishedAt !== null` (§8.4). `FakeServer` simulando push/pull de verdade,
 * sem precisar do Supabase real.
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

/** Espelha `save_workout_session`/`delete_workout_session` (migration 0026). */
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
}

function deviceClient(server: FakeServer): SyncSupabaseClient {
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
  };
}

function device(server: FakeServer) {
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  const local = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

/** Só marca pendente quando `finishedAt !== null` — mesma regra de `SyncingSessionRepository`. */
async function setSession(dev: Device, s: Session) {
  const current = await dev.local.getById(s.id);
  await dev.local.save(s, current?.updatedAt ?? null);
  if (s.finishedAt !== null) {
    await markPending(dev.tracker, "sessions", s.id);
  }
}

async function deleteSession(dev: Device, id: string) {
  await dev.local.remove(id);
  await markPending(dev.tracker, "sessions", id);
}

async function sync(dev: Device) {
  const push = await pushAllSessions(dev.client, dev.tracker, dev.local);
  const pull = await pullAllSessions(dev.client, dev.tracker, dev.local);
  return { push, pull };
}

describe("push/pullAllSessions — orquestração", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. uma sessão finalizada e pendente sobe e volta aplicada", async () => {
    const a = device(server);
    await setSession(a, session("sessao-1", { name: "Push", finishedAt: 2000 }));

    expect(await pushAllSessions(a.client, a.tracker, a.local)).toEqual({
      status: "done",
      pushed: ["sessao-1"],
      conflicts: [],
      errors: [],
    });
    expect(await pullAllSessions(a.client, a.tracker, a.local)).toEqual({
      status: "done",
      conflicts: [],
      invalid: [],
    });
  });

  it("2. sessão em andamento (finishedAt null) nunca entra pendente, nunca chama a rede", async () => {
    const a = device(server);
    await setSession(a, session("sessao-em-andamento", { finishedAt: null }));

    expect(await pushAllSessions(a.client, a.tracker, a.local)).toEqual({
      status: "nothing-pending",
    });
    expect(server.allRows()).toHaveLength(0);
    expect((await a.tracker.get("sessions:sessao-em-andamento"))).toBeUndefined();
  });

  it("2b. terminar a sessão (finishedAt deixa de ser null) a torna pendente e ela sobe", async () => {
    const a = device(server);
    await setSession(a, session("sessao-1", { finishedAt: null }));
    expect(await pushAllSessions(a.client, a.tracker, a.local)).toEqual({
      status: "nothing-pending",
    });

    await setSession(a, session("sessao-1", { finishedAt: 5000 }));
    expect(await pushAllSessions(a.client, a.tracker, a.local)).toMatchObject({
      status: "done",
      pushed: ["sessao-1"],
    });
    expect(server.allRows()).toHaveLength(1);
  });

  it("2c. editar uma sessão já finalizada e já sincronizada marca pendente normalmente", async () => {
    const a = device(server);
    await setSession(a, session("sessao-1", { name: "v1", finishedAt: 2000 }));
    await sync(a);

    await setSession(a, session("sessao-1", { name: "v2", finishedAt: 2000 }));
    expect(await pushAllSessions(a.client, a.tracker, a.local)).toMatchObject({
      status: "done",
      pushed: ["sessao-1"],
    });
    expect(server.allRows()[0]?.name).toBe("v2");
  });

  it("3. sessão nova de outro dispositivo aparece no pull sem nunca ter sido pedida por id", async () => {
    const a = device(server);
    const b = device(server);

    await setSession(a, session("sessao-1", { name: "Pull", finishedAt: 2000 }));
    await sync(a);

    const pull = await pullAllSessions(b.client, b.tracker, b.local);
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });

    const bSession = await b.local.getById("sessao-1");
    expect(bSession?.name).toBe("Pull");
  });

  it("4. A apaga, B edita a mesma sessão: conflito de exclusão-vs-edição, nenhum lado é aplicado sozinho", async () => {
    const a = device(server);
    const b = device(server);

    await setSession(a, session("sessao-1", { name: "Original", finishedAt: 2000 }));
    await sync(a);
    await sync(b);

    await deleteSession(a, "sessao-1");
    await sync(a);

    await setSession(b, session("sessao-1", { name: "Editada por B", finishedAt: 2000 }));
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ sessionId: "sessao-1", remote: null });
    expect(pull.conflicts[0]?.local?.name).toBe("Editada por B");

    expect((await b.local.getById("sessao-1"))?.name).toBe("Editada por B");
  });

  it("5. repetir push/pull várias vezes não duplica nem corrompe nada", async () => {
    const a = device(server);
    await setSession(a, session("sessao-1", { finishedAt: 2000 }));
    await sync(a);

    for (let i = 0; i < 4; i += 1) {
      const { push, pull } = await sync(a);
      expect(push).toEqual({ status: "nothing-pending" });
      expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    }

    expect(await a.local.listAll()).toHaveLength(1);
  });

  it("6. sessão apagada localmente antes de qualquer sync não chama a rede, só limpa a pendência", async () => {
    const a = device(server);
    await setSession(a, session("sessao-1", { finishedAt: 2000 }));
    await deleteSession(a, "sessao-1"); // Nunca chegou a subir.

    const push = await pushAllSessions(a.client, a.tracker, a.local);
    expect(push).toEqual({ status: "done", pushed: ["sessao-1"], conflicts: [], errors: [] });
    expect(server.allRows()).toHaveLength(0);
  });

  it("7. resolver o conflito 'manter local' reenvia a edição; 'usar servidor' aplica a exclusão", async () => {
    const a = device(server);
    const b = device(server);

    await setSession(a, session("sessao-1", { name: "Original", finishedAt: 2000 }));
    await sync(a);
    await sync(b);

    await deleteSession(a, "sessao-1");
    await sync(a);

    await setSession(b, session("sessao-1", { name: "Editada por B", finishedAt: 2000 }));
    const { pull } = await sync(b);
    if (pull.status !== "done") throw new Error("unreachable");
    const conflict = pull.conflicts[0];
    if (conflict === undefined) throw new Error("esperava um conflito");

    await resolveSessionConflict(b.tracker, b.local, conflict.sessionId, "keep-local", conflict.remote);
    const resolved = await sync(b);
    expect(resolved.push).toMatchObject({ status: "done", pushed: ["sessao-1"] });
    expect(server.allRows().find((r) => r.id === "sessao-1")?.deletedAt).toBeNull();
  });

  it("7b. resolver 'usar servidor' aplica a exclusão remota, descartando a edição local", async () => {
    const a = device(server);
    const b = device(server);

    await setSession(a, session("sessao-1", { name: "Original", finishedAt: 2000 }));
    await sync(a);
    await sync(b);

    await deleteSession(a, "sessao-1");
    await sync(a);

    await setSession(b, session("sessao-1", { name: "Editada por B", finishedAt: 2000 }));
    const { pull } = await sync(b);
    if (pull.status !== "done") throw new Error("unreachable");
    const conflict = pull.conflicts[0];
    if (conflict === undefined) throw new Error("esperava um conflito");

    await resolveSessionConflict(b.tracker, b.local, conflict.sessionId, "use-server", conflict.remote);
    expect(await b.local.getById("sessao-1")).toBeUndefined();
    expect(await pushAllSessions(b.client, b.tracker, b.local)).toEqual({
      status: "nothing-pending",
    });
  });
});
