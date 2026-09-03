import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalBodyRepository } from "@/features/body/data/local-body-repository";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import { EMPTY_MEASUREMENTS } from "@/features/body/services/body-log";
import type { BodyEntry, Measurements } from "@/features/body/types/body-entry";

import {
  pullAllBodyEntries,
  pushAllBodyEntries,
  resolveBodyEntryConflict,
} from "./body-entry-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Orquestração real de push/pull/resolve para `BodyEntry` — mesmo formato
 * de `diet-sync.test.ts` (`FakeServer` simulando push/pull de verdade), com
 * a diferença de que `save_body_entry`/`delete_body_entry` recebem campos
 * escalares soltos, não um `p_payload` — ver a doc de `body-entry-sync.ts`.
 */

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

function entry(day: string, overrides: Partial<BodyEntry> = {}): BodyEntry {
  return {
    id: day,
    day,
    // `??` trataria um `null` explícito em `overrides` como ausência e
    // cairia no padrão — errado aqui, onde `null` é um valor de teste
    // deliberado (peso não registrado), não "não escolhido".
    weightKg: "weightKg" in overrides ? (overrides.weightKg ?? null) : 80,
    bodyFatPercent: "bodyFatPercent" in overrides ? (overrides.bodyFatPercent ?? null) : null,
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
  measurements: Measurements;
  notes: string;
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

  /** Espelha `save_body_entry` (migration 0029) — mesmas duas ramificações que `save_diet`. */
  save(
    day: string,
    weightKg: number | null,
    bodyFatPercent: number | null,
    measurements: Measurements,
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
}

function deviceClient(server: FakeServer): SyncSupabaseClient {
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
          args.p_measurements as Measurements,
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
  };
}

function device(server: FakeServer) {
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  const local = new LocalBodyRepository(new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

async function setEntry(dev: Device, e: BodyEntry) {
  const current = await dev.local.getByDay(e.day);
  await dev.local.save(e, current?.updatedAt ?? null);
  await markPending(dev.tracker, "bodyEntries", e.day);
}

async function deleteEntry(dev: Device, day: string) {
  await dev.local.remove(day);
  await markPending(dev.tracker, "bodyEntries", day);
}

async function sync(dev: Device) {
  const push = await pushAllBodyEntries(dev.client, dev.tracker, dev.local);
  const pull = await pullAllBodyEntries(dev.client, dev.tracker, dev.local);
  return { push, pull };
}

describe("push/pullAllBodyEntries — orquestração", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. um registro pendente sobe e volta aplicado", async () => {
    const a = device(server);
    await setEntry(a, entry("2026-08-25", { weightKg: 80.5 }));

    expect(await pushAllBodyEntries(a.client, a.tracker, a.local)).toEqual({
      status: "done",
      pushed: ["2026-08-25"],
      conflicts: [],
      errors: [],
    });
    expect(await pullAllBodyEntries(a.client, a.tracker, a.local)).toEqual({
      status: "done",
      conflicts: [],
      invalid: [],
    });
  });

  it("2. dois dias locais, só um pendente: só ele sobe", async () => {
    const a = device(server);
    await setEntry(a, entry("2026-08-24"));
    await sync(a);

    await setEntry(a, entry("2026-08-25"));
    const push = await pushAllBodyEntries(a.client, a.tracker, a.local);
    expect(push).toMatchObject({ status: "done", pushed: ["2026-08-25"] });
    expect(server.allRows().map((r) => r.day).sort()).toEqual(["2026-08-24", "2026-08-25"]);
  });

  it("3. registro novo de outro dispositivo aparece no pull sem nunca ter sido pedido por dia", async () => {
    const a = device(server);
    const b = device(server);

    await setEntry(a, entry("2026-08-25", { weightKg: 79 }));
    await sync(a);

    const pull = await pullAllBodyEntries(b.client, b.tracker, b.local);
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });

    const bEntry = await b.local.getByDay("2026-08-25");
    expect(bEntry?.weightKg).toBe(79);
  });

  it("4. A apaga, B edita o mesmo dia: conflito de exclusão-vs-edição, nenhum lado é aplicado sozinho", async () => {
    const a = device(server);
    const b = device(server);

    await setEntry(a, entry("2026-08-25", { weightKg: 80 }));
    await sync(a);
    await sync(b);

    await deleteEntry(a, "2026-08-25");
    await sync(a);

    await setEntry(b, entry("2026-08-25", { weightKg: 81 }));
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ day: "2026-08-25", remote: null });
    expect(pull.conflicts[0]?.local?.weightKg).toBe(81);

    expect((await b.local.getByDay("2026-08-25"))?.weightKg).toBe(81);
  });

  it("5. repetir push/pull várias vezes não duplica nem corrompe nada", async () => {
    const a = device(server);
    await setEntry(a, entry("2026-08-25"));
    await sync(a);

    for (let i = 0; i < 4; i += 1) {
      const { push, pull } = await sync(a);
      expect(push).toEqual({ status: "nothing-pending" });
      expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    }

    expect(await a.local.listAll()).toHaveLength(1);
  });

  it("6. registro apagado localmente antes de qualquer sync não chama a rede, só limpa a pendência", async () => {
    const a = device(server);
    await setEntry(a, entry("2026-08-25"));
    await deleteEntry(a, "2026-08-25");

    const push = await pushAllBodyEntries(a.client, a.tracker, a.local);
    expect(push).toEqual({ status: "done", pushed: ["2026-08-25"], conflicts: [], errors: [] });
    expect(server.allRows()).toHaveLength(0);
  });

  it("7. resolver o conflito 'manter local' reenvia a edição; 'usar servidor' aplica a exclusão", async () => {
    const a = device(server);
    const b = device(server);

    await setEntry(a, entry("2026-08-25", { weightKg: 80 }));
    await sync(a);
    await sync(b);

    await deleteEntry(a, "2026-08-25");
    await sync(a);

    await setEntry(b, entry("2026-08-25", { weightKg: 81 }));
    const { pull } = await sync(b);
    if (pull.status !== "done") throw new Error("unreachable");
    const conflict = pull.conflicts[0];
    if (conflict === undefined) throw new Error("esperava um conflito");

    await resolveBodyEntryConflict(b.tracker, b.local, conflict.day, "keep-local", conflict.remote);
    const resolved = await sync(b);
    expect(resolved.push).toMatchObject({ status: "done", pushed: ["2026-08-25"] });
    expect(server.allRows().find((r) => r.day === "2026-08-25")?.deletedAt).toBeNull();
  });

  it("7b. resolver 'usar servidor' aplica a exclusão remota, descartando a edição local", async () => {
    const a = device(server);
    const b = device(server);

    await setEntry(a, entry("2026-08-25", { weightKg: 80 }));
    await sync(a);
    await sync(b);

    await deleteEntry(a, "2026-08-25");
    await sync(a);

    await setEntry(b, entry("2026-08-25", { weightKg: 81 }));
    const { pull } = await sync(b);
    if (pull.status !== "done") throw new Error("unreachable");
    const conflict = pull.conflicts[0];
    if (conflict === undefined) throw new Error("esperava um conflito");

    await resolveBodyEntryConflict(b.tracker, b.local, conflict.day, "use-server", conflict.remote);
    expect(await b.local.getByDay("2026-08-25")).toBeUndefined();
    expect(await pushAllBodyEntries(b.client, b.tracker, b.local)).toEqual({
      status: "nothing-pending",
    });
  });

  it("8. weightKg e bodyFatPercent nulos sobrevivem ao round-trip sem virar 0", async () => {
    const a = device(server);
    await setEntry(a, entry("2026-08-25", { weightKg: null, bodyFatPercent: null, notes: "só medidas hoje" }));
    await sync(a);

    const b = device(server);
    await pullAllBodyEntries(b.client, b.tracker, b.local);
    const pulled = await b.local.getByDay("2026-08-25");

    expect(pulled?.weightKg).toBeNull();
    expect(pulled?.bodyFatPercent).toBeNull();
    expect(pulled?.notes).toBe("só medidas hoje");
  });

  it("9. medidas parciais (só cintura) sobrevivem ao round-trip, resto continua null", async () => {
    const a = device(server);
    await setEntry(
      a,
      entry("2026-08-25", { measurements: { ...EMPTY_MEASUREMENTS, waist: 82.4 } }),
    );
    await sync(a);

    const b = device(server);
    await pullAllBodyEntries(b.client, b.tracker, b.local);
    const pulled = await b.local.getByDay("2026-08-25");

    expect(pulled?.measurements.waist).toBe(82.4);
    expect(pulled?.measurements.neck).toBeNull();
  });

  /**
   * Achado de auditoria de design (03/09/2026): em uso real apareceu um
   * modal de conflito perguntando "80 kg" contra "80 kg" — as duas
   * medições eram o mesmo peso, só a versão/timestamp divergia. Reproduz
   * exatamente o cenário: dois dispositivos que nunca sincronizaram entre
   * si registram o mesmo peso no mesmo dia.
   */
  it("10. BUG: dois dispositivos registram o mesmo peso (80 kg) sem nunca ter sincronizado entre si — zero conflito", async () => {
    const a = device(server);
    const b = device(server);

    await setEntry(a, entry("2026-08-25", { weightKg: 80 }));
    await sync(a);

    // B nunca puxou o registro de A — grava o mesmo peso por conta própria.
    await setEntry(b, entry("2026-08-25", { weightKg: 80 }));
    const { pull } = await sync(b);

    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await b.local.getByDay("2026-08-25"))?.weightKg).toBe(80);
  });

  it("11. mesmo cenário, mas com peso realmente diferente (80 vs 79) — conflito real, visível", async () => {
    const a = device(server);
    const b = device(server);

    await setEntry(a, entry("2026-08-25", { weightKg: 80 }));
    await sync(a);

    await setEntry(b, entry("2026-08-25", { weightKg: 79 }));
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]?.local?.weightKg).toBe(79);
    expect(pull.conflicts[0]?.remote?.weightKg).toBe(80);
  });

  it("12. diferença só em metadata (updatedAt) sem diferença de peso não bloqueia para sempre: um conflito já marcado se autorresolve assim que os dois lados convergem", async () => {
    const a = device(server);
    const b = device(server);

    await setEntry(a, entry("2026-08-25", { weightKg: 80 }));
    await sync(a);
    await setEntry(b, entry("2026-08-25", { weightKg: 79 }));
    await sync(b); // conflito real: 80 (servidor) vs 79 (local de B)

    // B decide manter o próprio valor por enquanto, mas alguém edita B
    // novamente para bater com o que já está no servidor (80) — sem nunca
    // ter clicado em "resolver".
    await setEntry(b, entry("2026-08-25", { weightKg: 80, updatedAt: 5000 }));
    const { pull } = await sync(b);

    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await b.local.getByDay("2026-08-25"))?.weightKg).toBe(80);
  });
});
