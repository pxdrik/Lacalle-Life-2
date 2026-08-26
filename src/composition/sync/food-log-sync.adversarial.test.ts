import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalFoodLogRepository } from "@/features/diet/data/local-food-log-repository";
import { FOOD_LOGS_STORE } from "@/features/diet/data/food-log-repository";
import type { FoodLog } from "@/features/diet/types/food-log";
import type { Meal } from "@/features/diet/types/diet";

import { pullFoodLog, pushFoodLog } from "./food-log-sync";
import type { WireMeal } from "./food-log-merge";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Ataque adversarial ao motor de sync do `FoodLog` com dois dispositivos de
 * verdade — pedido explícito do Pedro depois de ver o motor de merge
 * (§23.1) e a orquestração (§23.2) provados separadamente, antes de
 * construir qualquer UI em cima. Condição que ele colocou: não alterar a
 * implementação na primeira rodada — só atacar, registrar cada falha, e só
 * então corrigir e reexecutar a campanha inteira mais a suíte completa.
 *
 * Ver docs/arquitetura-sincronizacao.md §24 para o relatório dos achados.
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

function deviceClient(
  server: FakeServer,
  overrides: Partial<SyncSupabaseClient> = {},
): SyncSupabaseClient {
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
    ...overrides,
  };
}

function device(server: FakeServer) {
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  const local = new LocalFoodLogRepository(new MemoryStore<FoodLog>(FOOD_LOGS_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

async function setMeals(dev: Device, meals: readonly Meal[]) {
  const current = await dev.local.getByDay(DAY);
  const now = Date.now();
  await dev.local.save(
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
  await markPending(dev.tracker, "foodLog", DAY);
}

async function sync(dev: Device) {
  const push = await pushFoodLog(dev.client, dev.tracker, dev.local, DAY);
  const pull = await pullFoodLog(dev.client, dev.tracker, dev.local, DAY);
  return { push, pull };
}

describe("FoodLog — campanha adversarial com dois dispositivos", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. adição independente: A cria Meal A, B cria Meal B, os dois convergem para A+B", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A")]);
    await sync(a);

    // B cria a própria refeição sem nunca ter puxado o que A já tinha —
    // a primeira tentativa de push de B perde a corrida de criação
    // (o servidor já tem uma linha, ver §24 achado 1: isso não é
    // "conflict", é "stale" — precisa de outra rodada para convergir,
    // exatamente a propriedade de retry/idempotência do cenário 9/10).
    await setMeals(b, [meal("meal-B")]);
    const firstAttempt = await sync(b);
    expect(firstAttempt.push.status).toBe("stale");
    await sync(b); // Reenvia com a versão fresca aprendida no pull anterior.
    await sync(a); // A pega o que B mandou.

    const aLog = await a.local.getByDay(DAY);
    const bLog = await b.local.getByDay(DAY);
    expect(aLog?.meals.map((m) => m.id).sort()).toEqual(["meal-A", "meal-B"]);
    expect(bLog?.meals.map((m) => m.id).sort()).toEqual(["meal-A", "meal-B"]);
  });

  it("2. mesmo Meal.id editado nos dois dispositivos vira conflito visível, bloqueando o dia", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A", { name: "Original" })]);
    await sync(a);
    await sync(b); // B fica sabendo de meal-A.

    await setMeals(a, [meal("meal-A", { name: "Editado por A" })]);
    await sync(a);

    await setMeals(b, [meal("meal-A", { name: "Editado por B" })]);
    const { pull } = await sync(b);

    expect(pull.status).toBe("conflict");
  });

  it("3. A exclui Meal A, B ainda tem a cópia antiga sem editar: exclusão não é ressuscitada", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A")]);
    await sync(a);
    await sync(b);

    await setMeals(a, []);
    await sync(a);

    const { pull } = await sync(b);
    expect(pull.status).not.toBe("conflict");
    const bLog = await b.local.getByDay(DAY);
    expect(bLog?.meals.find((m) => m.id === "meal-A")).toBeUndefined();
  });

  it("4a. exclusão + edição concorrente, A sincroniza primeiro: resultado é conflito", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A", { name: "Original" })]);
    await sync(a);
    await sync(b);

    await setMeals(a, []); // A apaga.
    await setMeals(b, [meal("meal-A", { name: "Editado por B" })]); // B edita.

    await sync(a);
    const { pull } = await sync(b);

    expect(pull.status).toBe("conflict");
  });

  it("4b. exclusão + edição concorrente, B sincroniza primeiro: mesmo resultado do 4a (determinístico)", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A", { name: "Original" })]);
    await sync(a);
    await sync(b);

    await setMeals(a, []);
    await setMeals(b, [meal("meal-A", { name: "Editado por B" })]);

    await sync(b); // Ordem invertida em relação ao 4a.
    const { pull } = await sync(a);

    expect(pull.status).toBe("conflict");
  });

  it("5. offline: cria, edita e apaga várias refeições antes de reconectar; sync não duplica nada", async () => {
    const a = device(server);
    const b = device(server);
    await setMeals(a, [meal("seed")]);
    await sync(a);
    await sync(b);

    // Tudo isso "offline" — nenhum sync entre os passos.
    await setMeals(a, [meal("seed"), meal("meal-1", { name: "Café" })]);
    await setMeals(a, [
      meal("seed"),
      meal("meal-1", { name: "Café da manhã" }),
      meal("meal-2", { name: "Almoço" }),
    ]);
    await setMeals(a, [meal("seed"), meal("meal-1", { name: "Café da manhã" })]); // apaga meal-2

    // "Reconecta" e sincroniza.
    await sync(a);
    const { pull } = await sync(b);
    expect(pull.status).not.toBe("conflict");

    const bLog = await b.local.getByDay(DAY);
    expect(bLog?.meals.map((m) => m.id).sort()).toEqual(["meal-1", "seed"]);
    expect(bLog?.meals.find((m) => m.id === "meal-1")?.name).toBe("Café da manhã");
  });

  it("6. queda durante o push: a pendência local sobrevive, nada corrompe", async () => {
    const a = device(server);
    await setMeals(a, [meal("meal-A")]);

    const failing = deviceClient(server, { rpc: vi.fn().mockRejectedValue(new Error("net down")) });
    await expect(pushFoodLog(failing, a.tracker, a.local, DAY)).rejects.toThrow();

    expect((await a.tracker.get("foodLog:" + DAY))?.status).toBe("pending");
    expect(server.currentRow()).toBeUndefined();

    const retry = await pushFoodLog(a.client, a.tracker, a.local, DAY);
    expect(retry).toEqual({ status: "pushed" });
  });

  it("7. queda durante o pull: o push já aplicado continua de pé", async () => {
    const a = device(server);
    await setMeals(a, [meal("meal-A")]);
    expect(await pushFoodLog(a.client, a.tracker, a.local, DAY)).toEqual({ status: "pushed" });

    const failingPull = deviceClient(server, {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(
          chainableEqLazy(() => ({ data: null, error: { message: "connection reset" } })),
        ),
      }),
    });
    const pull = await pullFoodLog(failingPull, a.tracker, a.local, DAY);
    expect(pull).toEqual({ status: "error", message: "connection reset" });

    expect((await a.tracker.get("foodLog:" + DAY))?.status).toBe("clean");
    expect((await a.local.getByDay(DAY))?.meals).toHaveLength(1);
  });

  it("8. falha ao persistir o pull localmente: não marca como sincronizado, permite retry", async () => {
    const a = device(server);
    const b = device(server);
    await setMeals(b, [meal("meal-B")]);
    await sync(b);

    const brokenLocal = {
      listAll: () => a.local.listAll(),
      listBetween: (from: string, to: string) => a.local.listBetween(from, to),
      getByDay: (day: string) => a.local.getByDay(day),
      remove: (id: string) => a.local.remove(id),
      save: vi.fn().mockRejectedValue(new Error("IndexedDB quota exceeded")),
    };
    await expect(pullFoodLog(a.client, a.tracker, brokenLocal, DAY)).rejects.toThrow(
      "IndexedDB quota exceeded",
    );
    expect((await a.tracker.get("foodLog:" + DAY))?.serverUpdatedAt).toBeUndefined();

    const retry = await pullFoodLog(a.client, a.tracker, a.local, DAY);
    expect(retry.status).not.toBe("error");
    const aLog = await a.local.getByDay(DAY);
    expect(aLog?.meals.map((m) => m.id)).toEqual(["meal-B"]);
  });

  it("9/10. idempotência: dois dispositivos sincronizando repetidamente não duplicam nem divergem", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A")]);
    await sync(a);
    await sync(b);

    for (let i = 0; i < 4; i += 1) {
      const resultA = await sync(a);
      const resultB = await sync(b);
      expect(resultA.push.status).not.toBe("conflict");
      expect(resultB.push.status).not.toBe("conflict");
    }

    const aLog = await a.local.getByDay(DAY);
    const bLog = await b.local.getByDay(DAY);
    expect(aLog?.meals).toHaveLength(1);
    expect(bLog?.meals).toHaveLength(1);
  });

  it("11. ordem das refeições converge exatamente nos dois dispositivos, independente de quem sincronizou primeiro", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [
      meal("m-breakfast", { name: "Café", time: "08:00" }),
      meal("m-lunch", { name: "Almoço", time: "12:00" }),
    ]);
    await sync(a);
    await sync(b);

    await setMeals(b, [
      meal("m-breakfast", { name: "Café", time: "08:00" }),
      meal("m-lunch", { name: "Almoço", time: "12:00" }),
      meal("m-dinner", { name: "Jantar", time: "20:00" }),
    ]);
    await sync(b);
    await sync(a);

    const aLog = await a.local.getByDay(DAY);
    const bLog = await b.local.getByDay(DAY);
    expect(aLog?.meals.map((m) => m.id)).toEqual(["m-breakfast", "m-lunch", "m-dinner"]);
    expect(bLog?.meals.map((m) => m.id)).toEqual(aLog?.meals.map((m) => m.id));
  });

  it("12. tombstone continua existindo até o outro lado reconciliar — não é descartado cedo demais", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [meal("meal-A")]);
    await sync(a);
    await sync(b); // B sabe de meal-A.

    await setMeals(a, []); // A apaga.
    await pushFoodLog(a.client, a.tracker, a.local, DAY);

    // B ainda não sincronizou — o tombstone tem que sobreviver no servidor,
    // e um push de B (sem saber da exclusão) não pode simplesmente
    // sobrescrever o servidor como se nada tivesse acontecido.
    expect(server.currentRow()?.payload.meals.find((m) => m.id === "meal-A")?.deletedAt).not
      .toBeNull();

    await setMeals(b, [meal("meal-A"), meal("meal-B")]); // B, sem saber, mantém meal-A e adiciona meal-B.
    const bPush = await pushFoodLog(b.client, b.tracker, b.local, DAY);
    // B está desatualizado (não sabe do tombstone) — não devia conseguir
    // sobrescrever sem passar por um pull primeiro.
    expect(bPush.status).not.toBe("pushed");

    await pullFoodLog(b.client, b.tracker, b.local, DAY);
    const bLog = await b.local.getByDay(DAY);
    // Depois de reconciliar, o tombstone de A prevalece — meal-A não volta.
    expect(bLog?.meals.find((m) => m.id === "meal-A")).toBeUndefined();
  });

  it("13. ataque à granularidade por dia inteiro: um conflito numa refeição bloqueia o push das outras, limpas, no mesmo dia", async () => {
    const a = device(server);
    const b = device(server);

    await setMeals(a, [
      meal("meal-A", { name: "Café" }),
      meal("meal-B", { name: "Almoço" }),
    ]);
    await sync(a);
    await sync(b);

    // A edita meal-C (nova) e meal-B (conflito) ao mesmo tempo.
    await setMeals(a, [
      meal("meal-A", { name: "Café" }),
      meal("meal-B", { name: "Almoço - editado por A" }),
    ]);
    await sync(a);

    await setMeals(b, [
      meal("meal-A", { name: "Café" }),
      meal("meal-B", { name: "Almoço - editado por B" }),
      meal("meal-C", { name: "Jantar novo, sem conflito" }),
    ]);
    const { pull } = await sync(b);

    expect(pull.status).toBe("conflict");
    // Achado a documentar: meal-C (sem conflito nenhum) fica bloqueada
    // junto com meal-B só porque estão no mesmo dia — B não consegue
    // sincronizar o jantar novo enquanto o almoço não for resolvido.
    const pushAttempt = await pushFoodLog(b.client, b.tracker, b.local, DAY);
    expect(pushAttempt.status).toBe("conflict");
    expect(server.currentRow()?.payload.meals.find((m) => m.id === "meal-C")).toBeUndefined();
  });
});
