import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, trackerId, type SyncTracker } from "@/core/sync/sync-tracker";
import {
  LocalRestDayRepository,
  REST_DAYS_STORE,
} from "@/features/workouts/data/rest-day-repository";
import { SyncingRestDayRepository } from "@/features/workouts/data/syncing-rest-day-repository";
import { createRestDay, type RestDay } from "@/features/workouts/types/rest-day";

import { pullAllRestDays, pushAllRestDays } from "./rest-day-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Dia de descanso (roadmap 7.5) com dois aparelhos de verdade contra um
 * servidor falso com as mesmas duas ramificações de `save_rest_day` e
 * `delete_rest_day` (migração 0032). A garantia que importa aqui, além de
 * chegar no outro aparelho: **nenhum dia fica travado em "conflict"**, porque
 * o descanso não tem tela de conflito.
 */

const DAY = "2026-09-30";

interface Row {
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

  save(day: string, clientUpdatedAt: number, expected: string | null) {
    const row = this.rows.get(day);
    const alive = row !== undefined && row.deletedAt === null;
    const matches = expected === null ? !alive : row?.serverUpdatedAt === expected;
    if (!matches) return { server_updated_at: row?.serverUpdatedAt ?? this.#next(), applied: false };

    const serverUpdatedAt = this.#next();
    this.rows.set(day, { clientUpdatedAt, serverUpdatedAt, deletedAt: null });
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
  const local = new LocalRestDayRepository(new MemoryStore<RestDay>(REST_DAYS_STORE));
  const client: SyncSupabaseClient = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      const day = args.p_day as string;
      const expected = args.p_expected_server_updated_at as string | null;
      const result =
        fn === "save_rest_day"
          ? server.save(day, args.p_client_updated_at as number, expected)
          : server.delete(day, expected);
      return { data: [result] as never[], error: null };
    }),
    from: () => ({
      select: () =>
        chainableEqLazy(() => ({
          data: [...server.rows].map(([day, row]) => ({
            day,
            client_updated_at: row.clientUpdatedAt,
            server_updated_at: row.serverUpdatedAt,
            deleted_at: row.deletedAt,
          })),
          error: null,
        })),
    }),
  };

  return {
    /** O que a tela usa: grava local e marca pendente. */
    ui: new SyncingRestDayRepository(local, tracker),
    local,
    async sync() {
      await pushAllRestDays(client, tracker, local);
      await pullAllRestDays(client, tracker, local);
    },
    async isRest() {
      return (await local.getByDay(DAY)) !== undefined;
    },
    async status() {
      return (await tracker.get(trackerId("restDays", DAY)))?.status;
    },
    client,
  };
}

describe("dia de descanso entre dois aparelhos", () => {
  it("marcado num aparelho aparece no outro, e desfeito também", async () => {
    const server = new FakeServer();
    const phone = device(server);
    const pc = device(server);

    await phone.ui.save(createRestDay(DAY), null);
    await phone.sync();
    await pc.sync();
    expect(await pc.isRest()).toBe(true);

    await pc.ui.remove(DAY);
    await pc.sync();
    await phone.sync();
    expect(await phone.isRest()).toBe(false);
    expect(await phone.status()).toBe("clean");
  });

  it("os dois marcam sem ter sincronizado: concordam, nada trava", async () => {
    const server = new FakeServer();
    const phone = device(server);
    const pc = device(server);

    await phone.ui.save(createRestDay(DAY), null);
    await pc.ui.save(createRestDay(DAY), null);
    await phone.sync();
    await pc.sync();

    expect(await pc.isRest()).toBe(true);
    expect(await pc.status()).toBe("clean");
  });

  it("os dois desfazem sem ter sincronizado: concordam, nada trava", async () => {
    const server = new FakeServer();
    const phone = device(server);
    const pc = device(server);
    await phone.ui.save(createRestDay(DAY), null);
    await phone.sync();
    await pc.sync();

    await phone.ui.remove(DAY);
    await pc.ui.remove(DAY);
    await phone.sync();
    await pc.sync();

    expect(await pc.isRest()).toBe(false);
    expect(await pc.status()).toBe("clean");
  });

  it("discordam: vale o servidor, e o dia não fica em conflito", async () => {
    const server = new FakeServer();
    const phone = device(server);
    const pc = device(server);
    await phone.ui.save(createRestDay(DAY), null);
    await phone.sync();
    await pc.sync();

    // O PC desfaz sem rede; enquanto isso o celular desfaz e marca de novo.
    await pc.ui.remove(DAY);
    await phone.ui.remove(DAY);
    await phone.sync();
    await phone.ui.save(createRestDay(DAY), null);
    await phone.sync();

    await pc.sync();

    expect(await pc.isRest()).toBe(true);
    expect(await pc.status()).toBe("clean");
    expect(server.rows.get(DAY)?.deletedAt).toBeNull();
  });

  it("marcado e desfeito antes de subir: o servidor nunca fica sabendo", async () => {
    const server = new FakeServer();
    const phone = device(server);

    await phone.ui.save(createRestDay(DAY), null);
    await phone.ui.remove(DAY);
    await phone.sync();

    expect(phone.client.rpc).not.toHaveBeenCalled();
    expect(server.rows.size).toBe(0);
    expect(await phone.status()).toBe("clean");
  });
});
