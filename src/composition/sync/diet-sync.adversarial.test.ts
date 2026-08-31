import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, markPending, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalDietRepository } from "@/features/diet/data/local-diet-repository";
import { DIETS_STORE } from "@/features/diet/data/diet-store";
import type { Diet } from "@/features/diet/types/diet";

import { pullAllDiets, pushAllDiets, resolveDietConflict } from "./diet-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Ataque adversarial ao motor de sync de `Diet` com dois dispositivos de
 * verdade — mesmo pedido de sempre (ver `profile-sync.adversarial.test.ts`/
 * `food-log-sync.adversarial.test.ts`): não é fuzzing, é tentar quebrar as
 * garantias reais (nunca sobrescrever em silêncio, nunca perder uma edição
 * pendente, nunca duplicar) com cenários realistas de dois dispositivos.
 *
 * Além dos cenários já provados para `Profile`/`FoodLog`, `Diet` traz uma
 * pergunta nova por ser **muitos registros por usuário**: um conflito numa
 * dieta consegue bloquear o progresso de uma dieta vizinha, sem conflito
 * nenhum, na mesma chamada de sync? Para `FoodLog` a resposta documentada
 * é sim (achado 13, granularidade por dia inteiro) — mas lá as duas
 * refeições vivem na mesma linha do banco. Para `Diet`, cada dieta é sua
 * própria linha e seu próprio registro de `SyncTracker`; o cenário 10
 * abaixo existe para confirmar que essa independência é real, não só
 * assumida.
 */

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

function diet(id: string, overrides: Partial<Diet> = {}): Diet {
  return {
    id,
    name: overrides.name ?? id,
    meals: overrides.meals ?? [],
    weekdays: overrides.weekdays ?? [],
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
  };
}

interface ServerRow {
  id: string;
  payload: { name: string; meals: unknown; weekdays: unknown };
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

/** Mesma lógica de duas ramificações da migration real — ver a doc em `diet-sync.test.ts`. */
class FakeServer {
  #rows = new Map<string, ServerRow>();
  #clock = 0;

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-08-25T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

  save(
    id: string,
    payload: { name: string; meals: unknown; weekdays: unknown },
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
      if (fn === "save_diet") {
        const result = server.save(
          args.p_id as string,
          args.p_payload as { name: string; meals: unknown; weekdays: unknown },
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "delete_diet") {
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
  const local = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const client = deviceClient(server);
  return { tracker, local, client };
}

type Device = ReturnType<typeof device>;

async function editLocally(dev: Device, id: string, name: string) {
  const current = await dev.local.getById(id);
  await dev.local.save(diet(id, { name }), current?.updatedAt ?? null);
  await markPending(dev.tracker, "diets", id);
}

async function deleteLocally(dev: Device, id: string) {
  await dev.local.remove(id);
  await markPending(dev.tracker, "diets", id);
}

async function sync(dev: Device) {
  const push = await pushAllDiets(dev.client, dev.tracker, dev.local);
  const pull = await pullAllDiets(dev.client, dev.tracker, dev.local);
  return { push, pull };
}

describe("motor de sync de Diet — ataque adversarial", () => {
  let server: FakeServer;

  beforeEach(() => {
    server = new FakeServer();
  });

  it("1. PC cria uma dieta, celular sincroniza e recebe", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "dieta-1", "Cutting");
    await sync(pc);
    await sync(celular);

    expect((await celular.local.getById("dieta-1"))?.name).toBe("Cutting");
  });

  it("2. celular cria, PC sincroniza (sentido oposto do 1)", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(celular, "dieta-1", "Bulking");
    await sync(celular);
    await sync(pc);

    expect((await pc.local.getById("dieta-1"))?.name).toBe("Bulking");
  });

  it("3. offline: edita várias vezes, só sincroniza no final — sem limite de tempo na pendência", async () => {
    const pc = device(server);
    await editLocally(pc, "dieta-1", "v1");
    await editLocally(pc, "dieta-1", "v2");
    await editLocally(pc, "dieta-1", "v3");
    expect((await pc.tracker.get("diets:dieta-1"))?.status).toBe("pending");

    expect(await pushAllDiets(pc.client, pc.tracker, pc.local)).toMatchObject({
      status: "done",
      pushed: ["dieta-1"],
    });
    expect(server.row("dieta-1")?.payload.name).toBe("v3");
  });

  it("4. dois dispositivos editam a MESMA dieta ao mesmo tempo: o segundo push vira conflito bloqueado, nunca sobrescreve", async () => {
    const pc = device(server);
    const celular = device(server);

    await editLocally(pc, "dieta-1", "Do PC");
    await editLocally(celular, "dieta-1", "Do celular");

    expect(await pushAllDiets(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["dieta-1"],
    });

    const celularPush = await pushAllDiets(celular.client, celular.tracker, celular.local);
    expect(celularPush).toMatchObject({ status: "done", conflicts: ["dieta-1"] });

    // A edição do celular não foi perdida nem sobrescrita, e continua bloqueada.
    expect((await celular.local.getById("dieta-1"))?.name).toBe("Do celular");
    expect((await celular.tracker.get("diets:dieta-1"))?.status).toBe("conflict");
    expect(server.row("dieta-1")?.payload.name).toBe("Do PC");

    // Tentar de novo sem resolver não muda nada.
    expect(await pushAllDiets(celular.client, celular.tracker, celular.local)).toEqual({
      status: "nothing-pending",
    });
  });

  it("5. A tem edição local pendente e recebe uma edição de B via pull — bloqueia até resolução explícita", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, "dieta-1", "De B");
    await sync(b);

    await editLocally(a, "dieta-1", "De A, sem saber de B");
    const { pull } = await sync(a);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toEqual([
      { dietId: "dieta-1", local: expect.objectContaining({ name: "De A, sem saber de B" }), remote: expect.objectContaining({ name: "De B" }) },
    ]);
    expect((await a.local.getById("dieta-1"))?.name).toBe("De A, sem saber de B");
    expect((await a.tracker.get("diets:dieta-1"))?.status).toBe("conflict");

    // Resolução "manter local": destrava e o próximo push sobrescreve B.
    await resolveDietConflict(a.tracker, a.local, "dieta-1", "keep-local", pull.conflicts[0]?.remote ?? null);
    expect((await a.tracker.get("diets:dieta-1"))?.status).toBe("pending");
    expect(await pushAllDiets(a.client, a.tracker, a.local)).toMatchObject({
      pushed: ["dieta-1"],
    });
    expect(server.row("dieta-1")?.payload.name).toBe("De A, sem saber de B");
  });

  it("6. queda de rede durante o push: a pendência local sobrevive intacta, retry funciona", async () => {
    const pc = device(server);
    await editLocally(pc, "dieta-1", "v1");

    const failing = deviceClient(server, { rpc: vi.fn().mockRejectedValue(new Error("net down")) });
    await expect(pushAllDiets(failing, pc.tracker, pc.local)).rejects.toThrow("net down");

    expect((await pc.tracker.get("diets:dieta-1"))?.status).toBe("pending");
    expect((await pc.local.getById("dieta-1"))?.name).toBe("v1");
    expect(server.allRows()).toHaveLength(0);

    expect(await pushAllDiets(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["dieta-1"],
    });
  });

  it("7. push aplicado, mas o pull seguinte falha: o que já foi enviado continua de pé", async () => {
    const pc = device(server);
    await editLocally(pc, "dieta-1", "v1");
    expect(await pushAllDiets(pc.client, pc.tracker, pc.local)).toMatchObject({
      pushed: ["dieta-1"],
    });

    const brokenPull = deviceClient(server, {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(
          chainableEqLazy(() => ({ data: null, error: { message: "connection reset" } })),
        ),
      }),
    });
    expect(await pullAllDiets(brokenPull, pc.tracker, pc.local)).toEqual({
      status: "error",
      message: "connection reset",
    });

    expect((await pc.tracker.get("diets:dieta-1"))?.status).toBe("clean");
    expect((await pc.local.getById("dieta-1"))?.name).toBe("v1");
  });

  it("8. pull traz dado novo, mas a gravação local falha: não marca como sincronizado, permite retry", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(b, "dieta-1", "De B");
    await sync(b);

    const brokenLocal = {
      listAll: () => a.local.listAll(),
      getById: (id: string) => a.local.getById(id),
      remove: (id: string) => a.local.remove(id),
      save: vi.fn().mockRejectedValue(new Error("IndexedDB quota exceeded")),
    };
    await expect(pullAllDiets(a.client, a.tracker, brokenLocal)).rejects.toThrow(
      "IndexedDB quota exceeded",
    );
    expect((await a.tracker.get("diets:dieta-1"))?.serverUpdatedAt).toBeUndefined();

    const retry = await pullAllDiets(a.client, a.tracker, a.local);
    expect(retry).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await a.local.getById("dieta-1"))?.name).toBe("De B");
  });

  it("9/10 (idempotência). repetir sync várias vezes não duplica nem diverge", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "dieta-1", "v1");
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
    expect((await a.tracker.getAll()).filter((t) => t.store === "diets")).toHaveLength(1);
  });

  it("10. uma dieta em conflito não bloqueia o push/pull de uma dieta vizinha sem conflito, na mesma chamada", async () => {
    const a = device(server);
    const b = device(server);

    // As duas dietas já existem nos dois dispositivos.
    await editLocally(a, "dieta-conflito", "Original");
    await editLocally(a, "dieta-tranquila", "Sem drama");
    await sync(a);
    await sync(b);

    // A edita as duas; B edita só a que vai conflitar.
    await editLocally(a, "dieta-conflito", "Editada por A");
    await editLocally(a, "dieta-tranquila", "Também editada por A");
    await sync(a);

    await editLocally(b, "dieta-conflito", "Editada por B");
    const { push, pull } = await sync(b);

    // O push de B: a dieta em conflito falha, mas nada mais estava pendente
    // em B para essa chamada (B só editou a que conflita).
    expect(push).toMatchObject({ status: "done", conflicts: ["dieta-conflito"] });
    // O pull de B: a edição de A na dieta tranquila chega normalmente,
    // sem exigir nada sobre o conflito da outra.
    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts.map((c) => c.dietId)).toEqual(["dieta-conflito"]);
    expect((await b.local.getById("dieta-tranquila"))?.name).toBe("Também editada por A");
    expect((await b.tracker.get("diets:dieta-tranquila"))?.status).toBe("clean");
  });

  it("11. as duas apagam a mesma dieta sem nunca ter puxado uma da outra: o push perde a corrida (esperado, §22.3), mas o pull seguinte converge sozinho — nunca fica pedindo resolução para algo que já está resolvido", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "dieta-1", "Original");
    await sync(a);
    await sync(b);

    await deleteLocally(a, "dieta-1");
    await sync(a);

    // B nunca soube da exclusão de A — apaga por conta própria, com uma
    // versão esperada desatualizada. O push perde a corrida de propósito
    // (nunca sobrescreve em silêncio): acerta em cheio, mas é uma corrida
    // vazia, porque os dois lados já concordam no resultado.
    await deleteLocally(b, "dieta-1");
    const { push, pull } = await sync(b);

    expect(push).toMatchObject({ status: "done", conflicts: ["dieta-1"] });
    // Achado real da campanha adversarial: a primeira versão deste motor
    // reapresentava isso como conflito bloqueado para sempre — os dois
    // lados já não têm nada local a proteger, então o pull seguinte
    // reconhece a convergência e destrava sozinho, sem pedir nada ao
    // usuário. Corrigido em `pullAllDiets`: só é conflito de verdade
    // quando `currentLocal !== undefined` (uma edição real em jogo), nunca
    // só por o tracker ter passado por `"conflict"` no meio do caminho.
    expect(pull).toEqual({ status: "done", conflicts: [], invalid: [] });
    expect((await b.tracker.get("diets:dieta-1"))?.status).toBe("clean");
    expect(await b.local.getById("dieta-1")).toBeUndefined();
  });

  it("12a. exclusão + edição concorrente, A apaga e sincroniza primeiro: resultado é conflito", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "dieta-1", "Original");
    await sync(a);
    await sync(b);

    await deleteLocally(a, "dieta-1");
    await editLocally(b, "dieta-1", "Editada por B");

    await sync(a);
    const { pull } = await sync(b);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ dietId: "dieta-1", remote: null });
  });

  it("12b. exclusão + edição concorrente, B sincroniza primeiro: mesmo resultado do 12a (determinístico)", async () => {
    const a = device(server);
    const b = device(server);

    await editLocally(a, "dieta-1", "Original");
    await sync(a);
    await sync(b);

    await deleteLocally(a, "dieta-1");
    await editLocally(b, "dieta-1", "Editada por B");

    await sync(b); // Ordem invertida em relação ao 12a.
    const { pull } = await sync(a);

    expect(pull.status).toBe("done");
    if (pull.status !== "done") throw new Error("unreachable");
    expect(pull.conflicts).toHaveLength(1);
    expect(pull.conflicts[0]).toMatchObject({ dietId: "dieta-1", local: null });
  });
});
