import { beforeEach, describe, expect, it, vi } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { SYNC_TRACKER_STORE, trackerId, type SyncTracker } from "@/core/sync/sync-tracker";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";
import { LocalDietRepository } from "@/features/diet/data/local-diet-repository";
import { DIETS_STORE } from "@/features/diet/data/diet-store";
import type { Diet } from "@/features/diet/types/diet";
import { LocalBodyRepository } from "@/features/body/data/local-body-repository";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import type { BodyEntry } from "@/features/body/types/body-entry";

import { MIGRATIONS } from "../migrations";
import type { SyncSupabaseClient } from "./sync-supabase-client";
import { chainableEqLazy } from "./sync-query-builder.test-helper";

/**
 * Prova viva da correção estrutural do P1-01
 * (docs/arquitetura-sincronizacao.md §22, ver comentário em `sync-engine.ts`):
 *
 *     Nenhum run<Entity>Sync() pode iniciar push ou pull sem que o estado de
 *     tracking necessário esteja preparado.
 *
 * Ao contrário de `diet-sync.adversarial.test.ts` (que chama `pushAllDiets`/
 * `pullAllDiets` direto, com `MemoryStore`), este arquivo chama os próprios
 * `run<Entity>Sync()` exportados de `sync-engine.ts` — os mesmos pontos de
 * entrada que `routine-sync-status.tsx`, `session-sync-status.tsx`,
 * `body-entry-sync-status.tsx`, `diet-sync-status.tsx`,
 * `food-log-sync-status.tsx` e `manual-sync-button.tsx` chamam — contra um
 * IndexedDB real (`fake-indexeddb`, instalado por `vitest.setup.ts`), sem
 * nunca passar por `composition/data-providers.tsx`. Se a proteção
 * dependesse da ordem de montagem de algum componente, como acontecia antes
 * da correção, estes testes veriam exatamente o overwrite silencioso que o
 * P1-01 descreve.
 *
 * `currentDatabaseName` e `getSupabaseBrowserClient` são mockados para que
 * cada "dispositivo" seja literalmente um nome de banco IndexedDB diferente
 * (mesmo mecanismo real de `composition/identity.ts`) apontando para o
 * mesmo `FakeServer` compartilhado (o "Supabase" dos dois aparelhos).
 */

const state = vi.hoisted(() => ({
  dbName: "device-a",
  client: undefined as SyncSupabaseClient | undefined,
}));

vi.mock("../identity", () => ({
  currentDatabaseName: () => Promise.resolve(state.dbName),
}));

vi.mock("@/core/auth/supabase-browser-client", () => ({
  getSupabaseBrowserClient: () => state.client,
}));

import { runProfileSync, runDietSync, runBodyEntrySync } from "./sync-engine";

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000000";

interface ServerRow {
  id: string;
  payload: unknown;
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

/**
 * Um "Supabase" fake que serve `profiles` (singleton, sem `id`, chave
 * `"profile"` fixa), `diets` (UUID) e `body_entries` (dia) — as três formas
 * de chave que as cinco entidades sincronizadas usam. Mesma lógica de duas
 * ramificações (`expected === null` cria, senão faz OCC condicional) das
 * migrations reais — ver `diet-sync.adversarial.test.ts`.
 */
class FakeServer {
  #tables = new Map<string, Map<string, ServerRow>>();
  #clock = 0;

  #table(name: string): Map<string, ServerRow> {
    let table = this.#tables.get(name);
    if (table === undefined) {
      table = new Map();
      this.#tables.set(name, table);
    }
    return table;
  }

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-09-05T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
  }

  save(
    tableName: string,
    id: string,
    payload: unknown,
    clientUpdatedAt: number,
    expected: string | null,
  ): { server_updated_at: string; applied: boolean } {
    const table = this.#table(tableName);
    const row = table.get(id);

    if (expected === null) {
      if (row === undefined || row.deletedAt !== null) {
        const serverUpdatedAt = this.#nextTimestamp();
        table.set(id, { id, payload, clientUpdatedAt, serverUpdatedAt, deletedAt: null });
        return { server_updated_at: serverUpdatedAt, applied: true };
      }
      // "on conflict do nothing": já existe uma linha viva com esse id/dia —
      // é exatamente o caso do P1-01 (registro local sem tracker, servidor
      // já com dado). `applied: false` é o sinal que `pushXxx` usa para
      // recusar a sobrescrita e marcar conflito.
      return { server_updated_at: row.serverUpdatedAt, applied: false };
    }

    if (row === undefined || row.serverUpdatedAt !== expected) {
      return { server_updated_at: row?.serverUpdatedAt ?? expected, applied: false };
    }
    const serverUpdatedAt = this.#nextTimestamp();
    table.set(id, { id, payload, clientUpdatedAt, serverUpdatedAt, deletedAt: null });
    return { server_updated_at: serverUpdatedAt, applied: true };
  }

  delete(tableName: string, id: string, expected: string | null): { server_updated_at: string; applied: boolean } {
    const table = this.#table(tableName);
    const row = table.get(id);
    if (row === undefined) return { server_updated_at: this.#nextTimestamp(), applied: false };
    if (row.serverUpdatedAt !== expected) {
      return { server_updated_at: row.serverUpdatedAt, applied: false };
    }
    const serverUpdatedAt = this.#nextTimestamp();
    table.set(id, { ...row, serverUpdatedAt, deletedAt: serverUpdatedAt });
    return { server_updated_at: serverUpdatedAt, applied: true };
  }

  rows(tableName: string): readonly ServerRow[] {
    return [...this.#table(tableName).values()];
  }

  row(tableName: string, id: string): ServerRow | undefined {
    return this.#table(tableName).get(id);
  }
}

function deviceClient(server: FakeServer): SyncSupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "save_profile") {
        const result = server.save(
          "profiles",
          PROFILE_ID,
          args.p_payload,
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "delete_profile") {
        const result = server.delete(
          "profiles",
          PROFILE_ID,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "save_diet") {
        const result = server.save(
          "diets",
          args.p_id as string,
          args.p_payload,
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "delete_diet") {
        const result = server.delete(
          "diets",
          args.p_id as string,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "save_body_entry") {
        const result = server.save(
          "body_entries",
          args.p_day as string,
          {
            weight_kg: args.p_weight_kg,
            body_fat_percent: args.p_body_fat_percent,
            measurements: args.p_measurements,
            notes: args.p_notes,
          },
          args.p_client_updated_at as number,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      if (fn === "delete_body_entry") {
        const result = server.delete(
          "body_entries",
          args.p_day as string,
          args.p_expected_server_updated_at as string | null,
        );
        return { data: [result], error: null };
      }
      throw new Error(`unexpected rpc in this fake: ${fn}`);
    }) as SyncSupabaseClient["rpc"],
    from: vi.fn((tableName: string) => ({
      select: vi.fn().mockReturnValue(
        chainableEqLazy(() => ({
          data: server.rows(tableName).map((row) => {
            if (tableName === "profiles") {
              return {
                payload: row.payload,
                client_updated_at: row.clientUpdatedAt,
                server_updated_at: row.serverUpdatedAt,
                deleted_at: row.deletedAt,
              };
            }
            if (tableName === "body_entries") {
              const payload = row.payload as {
                weight_kg: number | null;
                body_fat_percent: number | null;
                measurements: unknown;
                notes: string | null;
              };
              return {
                day: row.id,
                weight_kg: payload.weight_kg,
                body_fat_percent: payload.body_fat_percent,
                measurements: payload.measurements,
                notes: payload.notes,
                client_updated_at: row.clientUpdatedAt,
                server_updated_at: row.serverUpdatedAt,
                deleted_at: row.deletedAt,
              };
            }
            return {
              id: row.id,
              payload: row.payload,
              client_updated_at: row.clientUpdatedAt,
              server_updated_at: row.serverUpdatedAt,
              deleted_at: row.deletedAt,
            };
          }),
          error: null,
        })),
      ),
    })) as unknown as SyncSupabaseClient["from"],
  };
}

/** Grava um `Profile` local diretamente, sem passar por `markPending` — simula um registro criado antes do sync existir. */
async function writeUntrackedProfile(dbName: string, weightKg: number): Promise<void> {
  const db = await openDatabase(dbName, MIGRATIONS);
  const local = new LocalProfileRepository(new IndexedDbStore<Profile>(db, PROFILE_STORE.name));
  const now = Date.now();
  await local.save(
    {
      id: PROFILE_ID,
      nutrition: {
        sex: "male",
        ageYears: 30,
        heightCm: 178,
        weightKg,
        activityLevel: "moderate",
        goal: "maintain",
      },
      createdAt: now,
      updatedAt: now,
    },
    null,
  );
}

async function readTrackerEntry(dbName: string, store: string, recordId: string): Promise<SyncTracker | undefined> {
  const db = await openDatabase(dbName, MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  return tracker.get(trackerId(store, recordId));
}

async function readLocalProfile(dbName: string): Promise<Profile | undefined> {
  const db = await openDatabase(dbName, MIGRATIONS);
  const local = new LocalProfileRepository(new IndexedDbStore<Profile>(db, PROFILE_STORE.name));
  return local.get();
}

/** Cada teste é um cenário "dispositivo de fábrica" — sem isto, o IndexedDB fake sobrevive entre testes e o segundo `writeUntrackedProfile` colide com o que o anterior já gravou. */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe("sync-engine — garantia estrutural contra overwrite silencioso (P1-01)", () => {
  let server: FakeServer;

  beforeEach(async () => {
    await deleteDatabase("device-a");
    await deleteDatabase("device-b");
    server = new FakeServer();
    state.dbName = "device-a";
    state.client = deviceClient(server);
  });

  it("Caso 1 — registro local sem tracker, servidor sem nada: sync aplica sem apagar nada e sem gerar conflito fantasma", async () => {
    await writeUntrackedProfile("device-a", 80);
    expect(await readTrackerEntry("device-a", "profile", PROFILE_ID)).toBeUndefined();

    const outcome = await runProfileSync();

    // Nada no servidor ainda: o push da entrada recém-backfilled sobe.
    expect(outcome.push.status).toBe("pushed");
    expect((await readLocalProfile("device-a"))?.nutrition.weightKg).toBe(80);
    expect((await readTrackerEntry("device-a", "profile", PROFILE_ID))?.status).toBe("clean");
    expect(server.row("profiles", PROFILE_ID)?.payload).toMatchObject({ weightKg: 80 });
  });

  it("Caso 2 — registro local sem tracker E servidor já tem outro valor: nunca sobrescreve silenciosamente, sempre conflito/pendência explícita", async () => {
    // "Outro dispositivo" já sincronizou um perfil antes de este dispositivo
    // sequer ter uma entrada no tracker (upgrade de versão antiga, ou
    // simplesmente nunca ter rodado sync neste device até agora).
    state.dbName = "device-b";
    await writeUntrackedProfile("device-b", 90);
    await runProfileSync();
    expect(server.row("profiles", PROFILE_ID)?.payload).toMatchObject({ weightKg: 90 });

    // Device A tem um valor local diferente, também sem tracker.
    state.dbName = "device-a";
    await writeUntrackedProfile("device-a", 82);
    expect(await readTrackerEntry("device-a", "profile", PROFILE_ID)).toBeUndefined();

    const outcome = await runProfileSync();

    // ANTES da correção: o push (expected=null) já bateria em "applied:
    // false" contra o valor de B — mas se por algum caminho o pull rodasse
    // primeiro contra um `entry === undefined`, o valor local de A (82)
    // seria substituído por 90 em silêncio, sem o usuário nunca saber que
    // um valor real (82) existiu. Com a correção: o backfill garante que A
    // já está "pending" antes de qualquer push/pull, então o servidor
    // recusa o push (não é uma criação — já existe uma linha viva) e o
    // motor marca conflito em vez de escolher um lado sozinho.
    expect(outcome.push.status).toBe("conflict");
    expect((await readTrackerEntry("device-a", "profile", PROFILE_ID))?.status).toBe("conflict");
    // O valor local de A nunca foi tocado.
    expect((await readLocalProfile("device-a"))?.nutrition.weightKg).toBe(82);
  });

  it("Caso 3 — dois pontos de entrada de sync rodando ao mesmo tempo (Promise.all): nenhuma perda silenciosa, resultado idempotente", async () => {
    await writeUntrackedProfile("device-a", 77);

    const [first, second] = await Promise.all([runProfileSync(), runProfileSync()]);

    // As duas chamadas competem para fazer o backfill e o push da mesma
    // entrada — `backfillUntracked` é idempotente (só escreve quando não
    // existe entrada nenhuma) e o servidor só aceita uma das duas criações
    // (`on conflict do nothing`, `applied: false` na perdedora). A chamada
    // que perde pode terminar em "nothing-pending" (correu depois que a
    // primeira já limpou o tracker) ou em "conflict" (o próprio servidor
    // recusou a segunda criação) — as duas são desfechos seguros: o valor
    // real (77) nunca é apagado nem trocado por outra coisa, o que é a
    // garantia que importa. Nenhum resultado pode ser um overwrite
    // silencioso.
    const results = [first.push.status, second.push.status];
    expect(
      results.every((status) => status === "pushed" || status === "nothing-pending" || status === "conflict"),
    ).toBe(true);
    // Local nunca é sobrescrito nem apagado por essa corrida.
    expect((await readLocalProfile("device-a"))?.nutrition.weightKg).toBe(77);
    // O servidor nunca ganha uma segunda linha por causa da corrida.
    expect(server.rows("profiles")).toHaveLength(1);
    expect(server.row("profiles", PROFILE_ID)?.payload).toMatchObject({ weightKg: 77 });
  });

  it("Caso 4 — fábrica de repository (data-providers) e sync manual disparados ao mesmo tempo: nenhuma race, ambos convergem", async () => {
    await writeUntrackedProfile("device-a", 91);

    // Simula a fábrica de `data-providers.tsx` fazendo seu próprio backfill
    // (redundante, mas inofensivo) ao mesmo tempo que o botão "Sincronizar"
    // chama `runProfileSync()` direto — exatamente a race original do
    // P1-01, só que agora com a proteção estrutural também dentro do
    // motor de sync, não só na fábrica.
    const db = await openDatabase("device-a", MIGRATIONS);
    const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
    const { backfillUntracked } = await import("@/core/sync/sync-tracker");

    const [, outcome] = await Promise.all([
      backfillUntracked(tracker, "profile", [PROFILE_ID]),
      runProfileSync(),
    ]);

    expect(outcome.push.status === "pushed" || outcome.push.status === "nothing-pending").toBe(true);
    expect((await readLocalProfile("device-a"))?.nutrition.weightKg).toBe(91);
    expect(server.row("profiles", PROFILE_ID)?.payload).toMatchObject({ weightKg: 91 });
  });

  it("Caso 5 — primeiro sync depois de upgrade de versão antiga: dado local antigo é preservado (nunca descartado silenciosamente)", async () => {
    // O dispositivo já tinha um perfil gravado antes da entidade `Profile`
    // ganhar sincronização — nenhuma entrada de tracker jamais existiu.
    await writeUntrackedProfile("device-a", 68);
    const before = await readLocalProfile("device-a");

    const outcome = await runProfileSync();

    expect(outcome.push.status).toBe("pushed");
    const after = await readLocalProfile("device-a");
    expect(after?.nutrition.weightKg).toBe(before?.nutrition.weightKg);
    expect(after?.nutrition.weightKg).toBe(68);
    expect(server.row("profiles", PROFILE_ID)?.payload).toMatchObject({ weightKg: 68 });
  });
});

/**
 * A garantia é da própria camada de sync (`open<Entity>SyncStores` em
 * `sync-engine.ts`), não uma exceção implementada só para `Profile`. Estes
 * dois testes provam a mesma coisa para as outras duas formas de chave que
 * as cinco entidades sincronizadas usam: UUID em lote (`Diet`, também usado
 * por `Routine`/`WorkoutSession`) e dia (`BodyEntry`, também usado por
 * `FoodLog`) — não repetem os cinco cenários acima em cada entidade (seria
 * testar a mesma linha de código cinco vezes), só confirmam que o backfill
 * de fato roda antes do push/pull nesses dois formatos.
 */
describe("sync-engine — a mesma garantia vale para entidades em lote e por dia", () => {
  let server: FakeServer;

  beforeEach(async () => {
    await deleteDatabase("device-a");
    server = new FakeServer();
    state.dbName = "device-a";
    state.client = deviceClient(server);
  });

  it("Diet (UUID, em lote): registro local sem tracker nunca é sobrescrito por um pull, mesmo se o servidor já tiver um id colidente", async () => {
    const db = await openDatabase("device-a", MIGRATIONS);
    const local = new LocalDietRepository(new IndexedDbStore<Diet>(db, DIETS_STORE.name));
    const diet: Diet = {
      id: "dieta-1",
      name: "Cutting local, nunca sincronizada",
      meals: [],
      weekdays: [],
      createdAt: 1000,
      updatedAt: 1000,
    };
    await local.save(diet, null);

    // O servidor já tem uma dieta com o MESMO id (ex.: já foi pushada antes
    // do tracker deste dispositivo ter sido perdido/restaurado).
    server.save("diets", "dieta-1", { name: "Servidor", meals: [], weekdays: [] }, 500, null);

    expect(await readTrackerEntry("device-a", "diets", "dieta-1")).toBeUndefined();

    const outcome = await runDietSync();

    expect(outcome.push).toMatchObject({ status: "done", conflicts: ["dieta-1"] });
    // A dieta local nunca foi trocada pela do servidor.
    expect((await local.getById("dieta-1"))?.name).toBe("Cutting local, nunca sincronizada");
    expect((await readTrackerEntry("device-a", "diets", "dieta-1"))?.status).toBe("conflict");
  });

  it("BodyEntry (dia): peso local sem tracker nunca é sobrescrito por um pull do mesmo dia vindo de outro dispositivo", async () => {
    const db = await openDatabase("device-a", MIGRATIONS);
    const local = new LocalBodyRepository(new IndexedDbStore<BodyEntry>(db, BODY_ENTRIES_STORE.name));
    const entry: BodyEntry = {
      id: "2026-09-05",
      day: "2026-09-05",
      weightKg: 82,
      bodyFatPercent: null,
      measurements: {} as BodyEntry["measurements"],
      notes: "",
      createdAt: 1000,
      updatedAt: 1000,
    };
    await local.save(entry, null);

    // "Outro dispositivo" já registrou 81kg no mesmo dia.
    server.save(
      "body_entries",
      "2026-09-05",
      { weight_kg: 81, body_fat_percent: null, measurements: {}, notes: "" },
      500,
      null,
    );

    expect(await readTrackerEntry("device-a", "bodyEntries", "2026-09-05")).toBeUndefined();

    const outcome = await runBodyEntrySync();

    expect(outcome.push).toMatchObject({ status: "done", conflicts: ["2026-09-05"] });
    // 82kg (o valor real que a pessoa registrou neste aparelho) não vira 81
    // silenciosamente — o exato cenário do "peso 80/81/82" do
    // arquitetura-sincronizacao.md §8.2, agora também coberto para um
    // registro que nunca teve entrada no tracker.
    expect((await local.getByDay("2026-09-05"))?.weightKg).toBe(82);
    expect((await readTrackerEntry("device-a", "bodyEntries", "2026-09-05"))?.status).toBe("conflict");
  });
});
