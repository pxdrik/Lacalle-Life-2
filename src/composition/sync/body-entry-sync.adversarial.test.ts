import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalBodyRepository } from "@/features/body/data/local-body-repository";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import { EMPTY_MEASUREMENTS } from "@/features/body/services/body-log";
import type { BodyEntry } from "@/features/body/types/body-entry";

import { pullAllBodyEntries, pushAllBodyEntries, resolveBodyEntryConflict } from "./body-entry-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Ataque adversarial ao motor de sync de `BodyEntry` com dois dispositivos
 * de verdade — mesmo pedido de sempre (ver `diet-sync.adversarial.test.ts`):
 * não é fuzzing, é tentar quebrar as garantias reais (nunca sobrescrever em
 * silêncio, nunca perder uma edição pendente, nunca duplicar) com cenários
 * realistas de dois dispositivos.
 *
 * O cenário 11 repete deliberadamente o ataque que achou o bug real na
 * campanha de `Diet` (duas exclusões concorrentes sem nunca ter puxado uma
 * da outra), em vez de presumir que copiar a correção também copiou a
 * garantia — ver a doc de `pullAllBodyEntries` para o raciocínio completo.
 */

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

function entry(day: string, weightKg: number, overrides: Partial<BodyEntry> = {}): BodyEntry {
  return {
    id: day,
    day,
    weightKg,
    bodyFatPercent: overrides.bodyFatPercent ?? null,
    measurements: overrides.measurements ?? EMPTY_MEASUREMENTS,
    notes: overrides.notes ?? "",
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
  };
}

interface ServerRow {
  day: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  measurements: BodyEntry["measurements"];
  notes: string;
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

/** Mesma lógica de duas ramificações da migration real — ver a doc em `body-entry-sync.test.ts`. */
class FakeServer {
  #rows = new Map<string, ServerRow>();
  #clock = 0;

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-08-25T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

  save(
    day: string,
    weightKg: number | null,
    bodyFatPercent: number | null,
    measurements: BodyEntry["measurements"],
    notes: string,
    clientUpdatedAt: number,
    expected: string | null,
  ): { server_updated_at: string; applied: boolean } {
    const row = this.#rows.get(day);

    if (expected === null) {
      if (row === undefined || row.deletedAt !== null) {
        const serverUpdatedAt = this.#nextTimestamp();
        this.#rows.set(day, {
          day,
          weightKg,
          bodyFatPercent,
          measurements,
          notes,
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
    this.#rows.set(day, {
      day,
      weightKg,
      bodyFatPercent,
      measurements,
      notes,
      clientUpdatedAt,
      serverUpdatedAt,
      deletedAt: null,
    });
    return { server_updated_at: serverUpdatedAt, applied: true };
  }

  delete(day: string, expected: string | null): { server_updated_at: string; applied: boolean } {
    const row = this.#rows.get(day);
    if (row === undefined) return { server_updated_at: this.#nextTimestamp(), applied: false };
    if (row.serverUpdatedAt !== expected) {
      return { server_updated_at: row.serverUpdatedAt, applied: false };
    }
    const serverUpdatedAt = this.#nextTimestamp();
    this.#rows.set(day, { ...row, serverUpdatedAt, deletedAt: serverUpdatedAt });
    return { server_updated_at: serverUpdatedAt, applied: true };
  }

  allRows(): readonly ServerRow[] {
    return [...this.#rows.values()];
  }

  row(day: string): ServerRow | undefined {
    return this.#rows.get(day);
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
      if (fn === "save_body_entry") {
        const result = server.save(
          args.p_day as string,
          args.p_weight_kg as number | null,
          args.p_body_fat_percent as number | null,
          args.p_measurements as BodyEntry["measurements"],
          args.p_notes as string,
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "delete_body_entry") {
        const result = server.delete(
          args.p_day as string,
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
            day: row.day,
            weight_kg: row.weightKg,
            body_fat_percent: row.bodyFatPercent,
            measurements: row.measurements,
            notes: row.notes,
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
  const local = new LocalBodyRepository(new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

async function editLocally(dev: Device, day: string, weightKg: number) {
  const current = await dev.local.getByDay(day);
  await dev.local.save(entry(day, weightKg), current?.updatedAt ?? null);
  await markPending(dev.tracker, "bodyEntries", day);
}

async function deleteLocally(dev: Device, day: string) {
  await dev.local.remove(day);
  await markPending(dev.tracker, "bodyEntries", day);
}

async function sync(dev: Device) {
  const push = await pushAllBodyEntries(dev.client, dev.tracker, dev.local);
  const pull = await pullAllBodyEntries(dev.client, dev.tracker, dev.local);
  return { push, pull };
}

describe("motor de sync de BodyEntry — ataque adversarial", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. PC registra um peso, celular sincroniza e recebe", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "2026-08-25", 80);
    await sync(pc);
    await sync(celular);

    expect((await celular.local.getByDay("2026-08-25"))?.weightKg).toBe(80);
  });

  it("2. celular registra, PC sincroniza (sentido oposto do 1)", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(celular, "2026-08-25", 79.5);
    await sync(celular);
    await sync(pc);

    expect((await pc.local.getByDay("2026-08-25"))?.weightKg).toBe(79.5);
  });

  it("3. offline: edita várias vezes, só sincroniza no final — sem limite de tempo na pendência", async () => {
    const pc = device(server);
    await editLocally(pc, "2026-08-25", 80);
    await editLocally(pc, "2026-08-25", 79.8);
    await editLocally(pc, "2026-08-25", 79.5);
    expect((await pc.tracker.get("bodyEntries:2026-08-25"))?.status).toBe("pending");

    expect(await pushAllBodyEntries(pc.client, pc.tracker, pc.local)).toMatchObject({
      status: "done",
      pushed: ["2026-08-25"],
    });
    expect(server.row("2026-08-25")?.weightKg).toBe(79.5);
  });

  it("4. dois dispositivos editam o MESMO dia ao mesmo tempo: o segundo push vira conflito bloqueado, nunca sobrescreve", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "2026-08-25", 80);
    await editLocally(celular, "2026-08-25", 81);

    expect(await pushAllBodyEntries(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["2026-08-25"],
    });

    const celularPush = await pushAllBodyEntries(celular.client, celular.tracker, celular.local);
    expect(celularPush).toMatchObject({ status: "done", conflicts: ["2026-08-25"] });

    expect((await celular.local.getByDay("2026-08-25"))?.weightKg).toBe(81);
    expect((await celular.tracker.get("bodyEntries:2026-08-25"))?.status).toBe("conflict");
    expect(server.row("2026-08-25")?.weightKg).toBe(80);

    expect(
      await pushAllBodyEntries(celular.client, celular.tracker, celular.local),
    ).toEqual({ status: "nothing-pending" });
  });

  it("5. A tem edição local pendente e recebe uma edição de B via pull — bloqueia até resolução explícita", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, "2026-08-25", 81);
    await sync(b);

    await editLocally(a, "2026-08-25", 80);
    const { pull } = await sync(a);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toEqual([
      {
        day: "2026-08-25",
        local: expect.objectContaining({ weightKg: 80 }),
        remote: expect.objectContaining({ weightKg: 81 }),
      },
    ]);
    expect((await a.local.getByDay("2026-08-25"))?.weightKg).toBe(80);
    expect((await a.tracker.get("bodyEntries:2026-08-25"))?.status).toBe("conflict");

    await resolveBodyEntryConflict(
      a.tracker,
      a.local,
      "2026-08-25",
      "keep-local",
      pull.conflicts[0]?.remote ?? null,
    );
    expect((await a.tracker.get("bodyEntries:2026-08-25"))?.status).toBe("pending");
    expect(await pushAllBodyEntries(a.client, a.tracker, a.local)).toMatchObject({
      pushed: ["2026-08-25"],
    });
    expect(server.row("2026-08-25")?.weightKg).toBe(80);
  });

  it("6. queda de rede durante o push: a pendência local sobrevive intacta, retry funciona", async () => {
    const pc = device(server);
    await editLocally(pc, "2026-08-25", 80);

    const failing = deviceClient(server, { rpc: vi.fn().mockRejectedValue(new Error("net down")) });
    await expect(pushAllBodyEntries(failing, pc.tracker, pc.local)).rejects.toThrow("net down");

    expect((await pc.tracker.get("bodyEntries:2026-08-25"))?.status).toBe("pending");
    expect((await pc.local.getByDay("2026-08-25"))?.weightKg).toBe(80);
    expect(server.allRows()).toHaveLength(0);

    expect(await pushAllBodyEntries(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["2026-08-25"],
    });
  });

  it("7. push aplicado, mas o pull seguinte falha: o que já foi enviado continua de pé", async () => {
    const pc = device(server);
    await editLocally(pc, "2026-08-25", 80);
    expect(await pushAllBodyEntries(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["2026-08-25"],
    });

    const brokenPull = deviceClient(server, {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(
          chainableEqLazy(() => ({ data: null, error: { message: "connection reset" } })),
        ),
      }),
    });
    expect(await pullAllBodyEntries(brokenPull, pc.tracker, pc.local)).toEqual({
      status: "error",
      message: "connection reset",
    });

    expect((await pc.tracker.get("bodyEntries:2026-08-25"))?.status).toBe("clean");
    expect((await pc.local.getByDay("2026-08-25"))?.weightKg).toBe(80);
  });

  it("8. pull traz dado novo, mas a gravação local falha: não marca como sincronizado, permite retry", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, "2026-08-25", 81);
    await sync(b);

    const brokenLocal = {
      listAll: () => a.local.listAll(),
      listBetween: (from: string, to: string) => a.local.listBetween(from, to),
      getByDay: (day: string) => a.local.getByDay(day),
      remove: (id: string) => a.local.remove(id),
      save: vi.fn().mockRejectedValue(new Error("IndexedDB quota exceeded")),
    };
    await expect(pullAllBodyEntries(a.client, a.tracker, brokenLocal)).rejects.toThrow(
      "IndexedDB quota exceeded",
    );
    expect((await a.tracker.get("bodyEntries:2026-08-25"))?.serverUpdatedAt).toBeUndefined();

    const retry = await pullAllBodyEntries(a.client, a.tracker, a.local);
    expect(retry).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await a.local.getByDay("2026-08-25"))?.weightKg).toBe(81);
  });

  it("9/10 (idempotência). repetir sync várias vezes não duplica nem diverge", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "2026-08-25", 80);
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
    expect((await a.tracker.getAll()).filter((t) => t.store === "bodyEntries")).toHaveLength(1);
  });

  it("10. um dia em conflito não bloqueia o push/pull de um dia vizinho sem conflito, na mesma chamada", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "2026-08-24", 80);
    await editLocally(a, "2026-08-25", 79.8);
    await sync(a);
    await sync(b);

    await editLocally(a, "2026-08-24", 80.5);
    await editLocally(a, "2026-08-25", 79.5);
    await sync(a);

    await editLocally(b, "2026-08-24", 81);
    const { push, pull } = await sync(b);

    expect(push).toMatchObject({ status: "done", conflicts: ["2026-08-24"] });
    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts.map((c) => c.day)).toEqual(["2026-08-24"]);
    expect((await b.local.getByDay("2026-08-25"))?.weightKg).toBe(79.5);
    expect((await b.tracker.get("bodyEntries:2026-08-25"))?.status).toBe("clean");
  });

  it("11. as duas apagam o mesmo dia sem nunca ter puxado uma da outra: o push perde a corrida (esperado, §22.3), mas o pull seguinte converge sozinho — nunca fica pedindo resolução para algo que já está resolvido", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "2026-08-25", 80);
    await sync(a);
    await sync(b);

    await deleteLocally(a, "2026-08-25");
    await sync(a);

    await deleteLocally(b, "2026-08-25");
    const { push, pull } = await sync(b);

    expect(push).toMatchObject({ status: "done", conflicts: ["2026-08-25"] });
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await b.tracker.get("bodyEntries:2026-08-25"))?.status).toBe("clean");
    expect(await b.local.getByDay("2026-08-25")).toBeUndefined();
  });

  it("12a. exclusão + edição concorrente, A apaga e sincroniza primeiro: resultado é conflito", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "2026-08-25", 80);
    await sync(a);
    await sync(b);

    await deleteLocally(a, "2026-08-25");
    await editLocally(b, "2026-08-25", 81);

    await sync(a);
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ day: "2026-08-25", remote: null });
  });

  it("12b. exclusão + edição concorrente, B sincroniza primeiro: mesmo resultado do 12a (determinístico)", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "2026-08-25", 80);
    await sync(a);
    await sync(b);

    await deleteLocally(a, "2026-08-25");
    await editLocally(b, "2026-08-25", 81);

    await sync(b); // Ordem invertida em relação ao 12a.
    const { pull } = await sync(a);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ day: "2026-08-25", local: null });
  });

  it("13. peso null (só medidas registradas) não vira conflito por engano quando os dois lados concordam", async () => {
    const a = device(server);
    const b = device(server);

    await a.local.save(
      {
        id: "2026-08-25",
        day: "2026-08-25",
        weightKg: null,
        bodyFatPercent: null,
        measurements: { ...EMPTY_MEASUREMENTS, waist: 80 },
        notes: "",
        createdAt: 1000,
        updatedAt: 1000,
      },
      null,
    );
    await markPending(a.tracker, "bodyEntries", "2026-08-25");
    await sync(a);

    const pull = await pullAllBodyEntries(b.client, b.tracker, b.local);
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await b.local.getByDay("2026-08-25"))?.weightKg).toBeNull();
    expect((await b.local.getByDay("2026-08-25"))?.measurements.waist).toBe(80);
  });
});
