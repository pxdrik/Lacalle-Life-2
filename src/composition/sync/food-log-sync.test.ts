import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalFoodLogRepository } from "@/features/diet/data/local-food-log-repository";
import { FOOD_LOGS_STORE } from "@/features/diet/data/food-log-repository";
import type { FoodLog } from "@/features/diet/types/food-log";
import type { Meal } from "@/features/diet/types/diet";

import { pullFoodLog, pushFoodLog, resolveFoodLogConflict } from "./food-log-sync";
import type { WireMeal } from "./food-log-merge";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Orquestração real de push/pull/resolve para `FoodLog` — a lógica de
 * merge em si já é provada isoladamente em `food-log-merge.test.ts`. Aqui
 * o alvo é: o tracker bloqueia em conflito, o snapshot é gravado e lido
 * certo, e o payload que sai bate com o que a RPC realmente recebe.
 */

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";
const DAY = "2026-08-25";

function meal(id: string, overrides: Partial<Meal> = {}): Meal {
  return {
    id,
    name: overrides.name ?? id,
    time: overrides.time ?? null,
    notes: overrides.notes ?? "",
    items: overrides.items ?? [],
  };
}

interface ServerRow {
  payload: { meals: readonly WireMeal[]; dietId: string | null };
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

class FakeServer {
  #row: ServerRow | undefined;
  #clock = 0;

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-08-25T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

  save(
    payload: { meals: readonly WireMeal[]; dietId: string | null },
    clientUpdatedAt: number,
    expected: string | null,
  ): { server_updated_at: string; applied: boolean } {
    if (this.#row === undefined || this.#row.deletedAt !== null) {
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

function deviceClient(server: FakeServer): SyncSupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "save_food_log") {
        const result = server.save(
          args.p_payload as { meals: readonly WireMeal[]; dietId: string | null },
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      throw new Error(`unexpected rpc in this fake: ${fn}`);
    }) as SyncSupabaseClient["rpc"],
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(
        chainableEqLazy(() => {
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
      ),
    }),
  };
}

function device(server: FakeServer) {
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  const local = new LocalFoodLogRepository(new MemoryStore<FoodLog>(FOOD_LOGS_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

async function setMeals(
  device: { local: LocalFoodLogRepository; tracker: MemoryStore<SyncTracker> },
  meals: readonly Meal[],
) {
  const current = await device.local.getByDay(DAY);
  const now = Date.now();
  await device.local.save(
    {
      id: DAY,
      day: DAY,
      meals,
      dietId: null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    },
    current?.updatedAt ?? null,
  );
  await markPending(device.tracker, "foodLog", DAY);
}

describe("push/pullFoodLog — orquestração", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. merge limpo entre dois dispositivos: push de A, pull de B traz tudo", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A")]);
    expect(await pushFoodLog(a.client, a.tracker, a.local, DAY)).toEqual({ status: "pushed" });

    await setMeals(b, [meal("meal-B")]);
    const pull = await pullFoodLog(b.client, b.tracker, b.local, DAY);
    // B tinha uma edição própria (meal-B) ainda não enviada — o merge a
    // preserva e sinaliza que falta subir, em vez de "applied" puro.
    expect(pull).toEqual({ status: "pending-unpushed" });
    // O merge trouxe meal-A e preservou meal-B local, pendente de subir.
    const bLog = await b.local.getByDay(DAY);
    expect(bLog?.meals.map((m) => m.id).sort()).toEqual(["meal-A", "meal-B"]);

    expect(await pushFoodLog(b.client, b.tracker, b.local, DAY)).toEqual({ status: "pushed" });

    const finalPull = await pullFoodLog(a.client, a.tracker, a.local, DAY);
    expect(finalPull).toEqual({ status: "applied" });
    const aLog = await a.local.getByDay(DAY);
    expect(aLog?.meals.map((m) => m.id).sort()).toEqual(["meal-A", "meal-B"]);
  });

  it("2. mesmo Meal.id editado nos dois dispositivos: pull bloqueia o dia inteiro até resolução", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A", { name: "Original" })]);
    await pushFoodLog(a.client, a.tracker, a.local, DAY);
    await pullFoodLog(b.client, b.tracker, b.local, DAY); // B agora conhece meal-A, snapshot em dia.

    await setMeals(a, [meal("meal-A", { name: "Editado por A" })]);
    await pushFoodLog(a.client, a.tracker, a.local, DAY);

    await setMeals(b, [meal("meal-A", { name: "Editado por B" })]);
    const pull = await pullFoodLog(b.client, b.tracker, b.local, DAY);

    expect(pull.status).toBe("conflict");
    if (pull.status !== "conflict") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]?.mealId).toBe("meal-A");

    // Bloqueado: push não tenta de novo sozinho, e nem chama o servidor.
    const rpcSpy = b.client.rpc as ReturnType<typeof vi.fn>;
    rpcSpy.mockClear();
    expect(await pushFoodLog(b.client, b.tracker, b.local, DAY)).toEqual({
      status: "conflict",
    });
    expect(rpcSpy).not.toHaveBeenCalled();

    await resolveFoodLogConflict(
      b.tracker,
      b.local,
      DAY,
      pull.conflicts,
      new Map([["meal-A", "keep-local"]]),
    );

    const resolvedPush = await pushFoodLog(b.client, b.tracker, b.local, DAY);
    expect(resolvedPush).toEqual({ status: "pushed" });
    expect(server.currentRow()?.payload.meals.find((m) => m.id === "meal-A")?.name).toBe(
      "Editado por B",
    );
  });

  it("2b. resolução 'usar servidor' aplica o valor remoto em vez do local", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A", { name: "Original" })]);
    await pushFoodLog(a.client, a.tracker, a.local, DAY);
    await pullFoodLog(b.client, b.tracker, b.local, DAY);

    await setMeals(a, [meal("meal-A", { name: "Editado por A" })]);
    await pushFoodLog(a.client, a.tracker, a.local, DAY);

    await setMeals(b, [meal("meal-A", { name: "Editado por B" })]);
    const pull = await pullFoodLog(b.client, b.tracker, b.local, DAY);
    if (pull.status !== "conflict") throw new Error("unreachable");

    await resolveFoodLogConflict(
      b.tracker,
      b.local,
      DAY,
      pull.conflicts,
      new Map([["meal-A", "use-server"]]),
    );

    const bLog = await b.local.getByDay(DAY);
    expect(bLog?.meals.find((m) => m.id === "meal-A")?.name).toBe("Editado por A");

    // O rascunho local foi descartado de propósito. Resolver sempre deixa
    // pendente um push seguinte — mesmo "usar servidor" em tudo, que nesse
    // caso é um envio idempotente (mesmo conteúdo que o servidor já tem),
    // nunca uma sobrescrita de verdade.
    expect(await pushFoodLog(b.client, b.tracker, b.local, DAY)).toEqual({
      status: "pushed",
    });
    expect(server.currentRow()?.payload.meals.find((m) => m.id === "meal-A")?.name).toBe(
      "Editado por A",
    );
  });

  it("3. exclusão concorrente: A apaga meal-A, B nunca editou — pull de B aplica o tombstone sem conflito", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A")]);
    await pushFoodLog(a.client, a.tracker, a.local, DAY);
    await pullFoodLog(b.client, b.tracker, b.local, DAY);

    await setMeals(a, []); // A apaga meal-A.
    await pushFoodLog(a.client, a.tracker, a.local, DAY);

    const pull = await pullFoodLog(b.client, b.tracker, b.local, DAY);
    expect(pull).toEqual({ status: "applied" });
    const bLog = await b.local.getByDay(DAY);
    expect(bLog?.meals).toHaveLength(0);
  });

  it("4. offline + retry: fechar e reabrir com outbox pendente não duplica nem corrompe", async () => {
    const a = device(server);
    await setMeals(a, [meal("meal-A")]);

    const failingClient: SyncSupabaseClient = {
      ...a.client,
      rpc: vi.fn().mockRejectedValue(new Error("network down")),
    };
    await expect(pushFoodLog(failingClient, a.tracker, a.local, DAY)).rejects.toThrow();

    // "Reabre": mesmos stores, cliente que funciona.
    const retry = await pushFoodLog(a.client, a.tracker, a.local, DAY);
    expect(retry).toEqual({ status: "pushed" });

    // Repetir de novo não duplica nem gera conflito consigo mesmo.
    for (let i = 0; i < 3; i += 1) {
      expect(await pushFoodLog(a.client, a.tracker, a.local, DAY)).toEqual({
        status: "nothing-pending",
      });
      expect(await pullFoodLog(a.client, a.tracker, a.local, DAY)).toEqual({
        status: "applied",
      });
    }
    const finalLog = await a.local.getByDay(DAY);
    expect(finalLog?.meals).toHaveLength(1);
  });
});
