import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, trackerId, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalWaterRepository } from "@/features/hydration/data/local-water-repository";
import { SyncingWaterRepository } from "@/features/hydration/data/syncing-water-repository";
import { WATER_ENTRIES_STORE } from "@/features/hydration/data/water-repository";
import type { WaterEntry } from "@/features/hydration/types/water-entry";

import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";
import { syncWaterEntries } from "./water-entry-sync";

/**
 * Roadmap 8.18 (30/09/2026): a água só subia, nunca descia para outro
 * aparelho, e um dia em conflito parava de sincronizar para sempre. Dois
 * aparelhos de verdade contra um servidor falso com as mesmas duas
 * ramificações de `save_water_entry`/`delete_water_entry` (migração 0031).
 */

const DAY = "2026-09-30";

interface Row {
  ml: number;
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

class FakeServer {
  readonly rows = new Map<string, Row>();
  #clock = 0;

  #next(): string {
    this.#clock += 1;
    return `2026-09-30T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

  save(day: string, ml: number, clientUpdatedAt: number, expected: string | null) {
    const row = this.rows.get(day);
    const alive = row !== undefined && row.deletedAt === null;
    const matches = expected === null ? !alive : row?.serverUpdatedAt === expected;
    if (!matches) return { server_updated_at: row?.serverUpdatedAt ?? this.#next(), applied: false };

    const serverUpdatedAt = this.#next();
    this.rows.set(day, { ml, clientUpdatedAt, serverUpdatedAt, deletedAt: null });
    return { server_updated_at: serverUpdatedAt, applied: true };
  }

  delete(day: string, expected: string | null) {
    const row = this.rows.get(day);
    if (row === undefined || row.serverUpdatedAt !== expected) {
      return { server_updated_at: row?.serverUpdatedAt ?? this.#next(), applied: false };
    }
    const serverUpdatedAt = this.#next();
    this.rows.set(day, { ...row, serverUpdatedAt, deletedAt: serverUpdatedAt });
    return { server_updated_at: serverUpdatedAt, applied: true };
  }
}

function device(server: FakeServer) {
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  const local = new LocalWaterRepository(new MemoryStore<WaterEntry>(WATER_ENTRIES_STORE));
  const ui = new SyncingWaterRepository(local, tracker);
  let clock = 1000;
  const client: SyncSupabaseClient = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      const day = args.p_day as string;
      const expected = args.p_expected_server_updated_at as string | null;
      const result =
        fn === "save_water_entry"
          ? server.save(day, args.p_ml as number, args.p_client_updated_at as number, expected)
          : server.delete(day, expected);
      return { data: [result] as never[], error: null };
    }),
    from: () => ({
      select: () =>
        chainableEqLazy(() => ({
          data: [...server.rows].map(([day, row]) => ({
            day,
            ml: row.ml,
            client_updated_at: row.clientUpdatedAt,
            server_updated_at: row.serverUpdatedAt,
            deleted_at: row.deletedAt,
          })),
          error: null,
        })),
    }),
  };

  return {
    /** O que a tela faz: grava o total do dia, ou apaga quando volta a zero. */
    async log(ml: number) {
      const current = await local.getByDay(DAY);
      clock += 1000;
      if (ml <= 0) {
        await ui.remove(DAY);
        return;
      }
      await ui.save(
        { id: DAY, day: DAY, ml, createdAt: current?.createdAt ?? clock, updatedAt: clock },
        current?.updatedAt ?? null,
      );
    },
    sync: () => syncWaterEntries(client, tracker, local),
    async ml() {
      return (await local.getByDay(DAY))?.ml ?? 0;
    },
    async status() {
      return (await tracker.get(trackerId("waterEntries", DAY)))?.status;
    },
  };
}

describe("água entre dois aparelhos", () => {
  it("registrada no celular chega no PC", async () => {
    const server = new FakeServer();
    const phone = device(server);
    const pc = device(server);

    await phone.log(500);
    await phone.sync();
    await pc.sync();

    expect(await pc.ml()).toBe(500);
  });

  it("apagada num, editada no outro: vale o servidor, e o dia não trava", async () => {
    const server = new FakeServer();
    const phone = device(server);
    const pc = device(server);
    await phone.log(500);
    await phone.sync();
    await pc.sync();

    await pc.log(0); // sem rede
    await phone.log(750);
    await phone.sync();
    await pc.sync();

    expect(await pc.ml()).toBe(750);
    expect(await pc.status()).toBe("clean");

    // Destravado: a próxima edição do PC sobe normalmente.
    await pc.log(1000);
    await pc.sync();
    await phone.sync();
    expect(await phone.ml()).toBe(1000);
  });

  it("editada num, apagada no outro: vale o servidor, e o dia não trava", async () => {
    const server = new FakeServer();
    const phone = device(server);
    const pc = device(server);
    await phone.log(500);
    await phone.sync();
    await pc.sync();

    await pc.log(750); // sem rede
    await phone.log(0);
    await phone.sync();
    await pc.sync();

    expect(await pc.ml()).toBe(0);
    expect(await pc.status()).toBe("clean");
  });
});
