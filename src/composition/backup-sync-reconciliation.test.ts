import { beforeEach, describe, expect, it, vi } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { SYNC_TRACKER_STORE, trackerId, type SyncTracker } from "@/core/sync/sync-tracker";
import { createDiet } from "@/features/diet/services/create-diet";
import type { Diet } from "@/features/diet/types/diet";

import { exportAll, importAll } from "./backup";
import { pullAllDiets, pushAllDiets } from "./sync/diet-sync";
import type { SyncSupabaseClient } from "./sync/sync-supabase-client";
import { chainableEqLazy } from "./sync/sync-query-builder.test-helper";
import { DATABASE_NAME, MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";

/**
 * Prova viva da correção do P1-02 (`reconcileSyncTrackerAfterImport` em
 * `backup.ts`, `resetPendingForImport` em `sync-tracker.ts`): restaurar um
 * backup nunca pode deixar o motor de sync achando que está tudo em dia
 * quando não está, nem tratar um dado restaurado como já confirmado contra
 * o servidor.
 *
 * Roda contra o banco anônimo real (`DATABASE_NAME`), o mesmo que
 * `backup.test.ts` usa — `importAll`/`exportAll` resolvem `currentDatabaseName()`
 * para esse nome sozinhos sem Supabase configurado no ambiente de teste, então
 * não é preciso mockar identidade aqui. `pushAllDiets`/`pullAllDiets` são
 * chamados diretamente (mesmo padrão de `diet-sync.adversarial.test.ts`) contra
 * um `FakeServer`, para poder controlar exatamente o que "o servidor" já tem
 * quando cada backup é restaurado.
 */

async function clearAllStores() {
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
  const names = [...db.objectStoreNames];
  const tx = db.transaction(names, "readwrite");
  await Promise.all([...names.map((name) => tx.objectStore(name).clear()), tx.done]);
}

async function trackerEntry(id: string): Promise<SyncTracker | undefined> {
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  return tracker.get(trackerId("diets", id));
}

async function localDiet(id: string): Promise<Diet | undefined> {
  const repositories = await getRepositories();
  return repositories.diets.getById(id);
}

async function saveDiet(diet: Diet): Promise<void> {
  const repositories = await getRepositories();
  const current = await repositories.diets.getById(diet.id);
  await repositories.diets.save(diet, current?.updatedAt ?? null);
}

interface ServerRow {
  id: string;
  payload: { name: string; meals: unknown; weekdays: unknown };
  clientUpdatedAt: number;
  serverUpdatedAt: string;
  deletedAt: string | null;
}

/** Mesma lógica de duas ramificações da RPC real — ver `diet-sync.adversarial.test.ts`. */
class FakeServer {
  #rows = new Map<string, ServerRow>();
  #clock = 0;

  #nextTimestamp(): string {
    this.#clock += 1;
    return `2026-09-05T00:00:${String(this.#clock).padStart(2, "0")}.000Z`;
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

  row(id: string): ServerRow | undefined {
    return this.#rows.get(id);
  }

  allRows(): readonly ServerRow[] {
    return [...this.#rows.values()];
  }
}

function client(server: FakeServer): SyncSupabaseClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "save_diet") {
        return {
          data: [
            server.save(
              args.p_id as string,
              args.p_payload as { name: string; meals: unknown; weekdays: unknown },
              args.p_client_updated_at as number,
              args.p_expected_server_updated_at as string | null,
            ),
          ],
          error: null,
        };
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
  };
}

describe("restaurar backup — reconciliação do syncTracker (P1-02)", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("Caso 1 — importar backup em dispositivo nunca sincronizado: registro fica pendente, nunca invisível", async () => {
    await saveDiet(createDiet("Cutting"));
    const backup = await exportAll();
    await clearAllStores();

    const result = await importAll(backup);
    expect(result.ok).toBe(true);

    const [diet] = await (await getRepositories()).diets.listAll();
    expect(diet?.name).toBe("Cutting");
    expect((await trackerEntry(diet!.id))?.status).toBe("pending");
    expect((await trackerEntry(diet!.id))?.serverUpdatedAt).toBeNull();
  });

  it("Caso 2 — importar backup em dispositivo já sincronizado: um registro que some no restore continua pendente (a exclusão precisa chegar ao servidor)", async () => {
    // Backup de "OUTRO estado", que nunca teve `oldDiet` — construído à parte,
    // sem tocar no banco onde o cenário abaixo vai rodar.
    await saveDiet(createDiet("Substituta"));
    const replacementBackup = await exportAll();
    await clearAllStores();

    // O dispositivo já tinha `oldDiet` sincronizada ("clean") antes do import.
    const oldDiet = createDiet("Vai sumir no restore");
    await saveDiet(oldDiet);
    const server = new FakeServer();
    server.save(oldDiet.id, { name: oldDiet.name, meals: [], weekdays: [] }, oldDiet.updatedAt, null);
    expect(
      await pullAllDiets(client(server), new IndexedDbStore<SyncTracker>(await openDatabase(DATABASE_NAME, MIGRATIONS), SYNC_TRACKER_STORE.name), (await getRepositories()).diets),
    ).toMatchObject({ status: "done" });
    expect((await trackerEntry(oldDiet.id))?.status).toBe("clean");

    await importAll(replacementBackup);

    expect(await localDiet(oldDiet.id)).toBeUndefined();
    // Nunca fica "clean" órfão — precisa virar pendente para propagar a exclusão.
    expect((await trackerEntry(oldDiet.id))?.status).toBe("pending");
  });

  it("Caso 3 — backup mais antigo que o servidor: restaurar não sobrescreve o servidor em silêncio, gera conflito explícito", async () => {
    const diet = createDiet("v1");
    await saveDiet(diet);
    const oldBackup = await exportAll(); // captura o conteúdo "v1"

    // O mesmo dispositivo evolui para "v2" e sincroniza — o servidor agora
    // tem v2, mais novo que o backup antigo.
    const server = new FakeServer();
    const dbForTracker = await openDatabase(DATABASE_NAME, MIGRATIONS);
    const tracker = new IndexedDbStore<SyncTracker>(dbForTracker, SYNC_TRACKER_STORE.name);
    const repositories = await getRepositories();
    await repositories.diets.save({ ...diet, name: "v2", updatedAt: diet.updatedAt + 1 }, diet.updatedAt);
    const { markPending } = await import("@/core/sync/sync-tracker");
    await markPending(tracker, "diets", diet.id);
    expect(await pushAllDiets(client(server), tracker, repositories.diets)).toMatchObject({
      pushed: [diet.id],
    });
    expect(server.row(diet.id)?.payload.name).toBe("v2");

    // Agora o usuário restaura o backup ANTIGO (v1) por engano.
    await importAll(oldBackup);
    expect((await localDiet(diet.id))?.name).toBe("v1");
    expect((await trackerEntry(diet.id))?.status).toBe("pending");
    expect((await trackerEntry(diet.id))?.serverUpdatedAt).toBeNull();

    // O próximo push nunca sobrescreve v2 silenciosamente: o servidor já
    // tem uma linha viva, então a tentativa de criação é recusada.
    const push = await pushAllDiets(client(server), tracker, repositories.diets);
    expect(push).toMatchObject({ status: "done", conflicts: [diet.id] });
    expect(server.row(diet.id)?.payload.name).toBe("v2"); // nunca virou v1 no servidor
    expect((await trackerEntry(diet.id))?.status).toBe("conflict");
  });

  it("Caso 4 — backup contendo registro que já existe no servidor (mesmo conteúdo): ainda assim vira conflito explícito, nunca assumido como igual", async () => {
    const diet = createDiet("Mesmo conteúdo");
    await saveDiet(diet);
    const backup = await exportAll();

    const server = new FakeServer();
    server.save(diet.id, { name: diet.name, meals: [], weekdays: [] }, diet.updatedAt, null);

    await importAll(backup);
    const dbForTracker = await openDatabase(DATABASE_NAME, MIGRATIONS);
    const tracker = new IndexedDbStore<SyncTracker>(dbForTracker, SYNC_TRACKER_STORE.name);
    const repositories = await getRepositories();

    const push = await pushAllDiets(client(server), tracker, repositories.diets);
    // Sem comparar conteúdo, o motor não tem como saber que os dois lados já
    // concordam — trata como qualquer colisão de id: conflito explícito, não
    // uma sobrescrita silenciosa "porque de qualquer jeito é igual".
    expect(push).toMatchObject({ status: "done", conflicts: [diet.id] });
  });

  it("Caso 5 — backup contendo registro inexistente no servidor: sobe normalmente, sem conflito", async () => {
    const diet = createDiet("Novo de verdade");
    await saveDiet(diet);
    const backup = await exportAll();
    await clearAllStores();

    await importAll(backup);
    const dbForTracker = await openDatabase(DATABASE_NAME, MIGRATIONS);
    const tracker = new IndexedDbStore<SyncTracker>(dbForTracker, SYNC_TRACKER_STORE.name);
    const repositories = await getRepositories();
    const server = new FakeServer();

    const push = await pushAllDiets(client(server), tracker, repositories.diets);
    expect(push).toMatchObject({ status: "done", pushed: [diet.id] });
    expect(server.row(diet.id)?.payload.name).toBe("Novo de verdade");
  });

  it("Caso 6 — backup seguido imediatamente por sync: push e pull no mesmo ciclo funcionam de ponta a ponta", async () => {
    const diet = createDiet("Ponta a ponta");
    await saveDiet(diet);
    const backup = await exportAll();
    await clearAllStores();

    await importAll(backup);
    const dbForTracker = await openDatabase(DATABASE_NAME, MIGRATIONS);
    const tracker = new IndexedDbStore<SyncTracker>(dbForTracker, SYNC_TRACKER_STORE.name);
    const repositories = await getRepositories();
    const server = new FakeServer();

    const push = await pushAllDiets(client(server), tracker, repositories.diets);
    expect(push).toMatchObject({ status: "done", pushed: [diet.id] });
    const pull = await pullAllDiets(client(server), tracker, repositories.diets);
    expect(pull).toMatchObject({ status: "done", conflicts: [] });
    expect((await trackerEntry(diet.id))?.status).toBe("clean");
  });

  it("Caso 7 — import + reload + sync: a reconciliação sobrevive a uma conexão nova ao banco (simula fechar e reabrir o app)", async () => {
    const diet = createDiet("Sobrevive a reload");
    await saveDiet(diet);
    const backup = await exportAll();
    await clearAllStores();
    await importAll(backup);

    // "Reload": conexões inteiramente novas ao mesmo banco, nada reaproveitado
    // da chamada de import.
    const dbAfterReload = await openDatabase(DATABASE_NAME, MIGRATIONS);
    const trackerAfterReload = new IndexedDbStore<SyncTracker>(dbAfterReload, SYNC_TRACKER_STORE.name);
    const repositoriesAfterReload = await getRepositories();
    const server = new FakeServer();

    expect((await trackerAfterReload.get(trackerId("diets", diet.id)))?.status).toBe("pending");
    const push = await pushAllDiets(client(server), trackerAfterReload, repositoriesAfterReload.diets);
    expect(push).toMatchObject({ status: "done", pushed: [diet.id] });
  });

  it("Caso 8 — import + edição + sync: editar logo depois do restore não perde o reset do tracker nem o conteúdo editado", async () => {
    const diet = createDiet("Antes de editar");
    await saveDiet(diet);
    const backup = await exportAll();
    await clearAllStores();
    await importAll(backup);

    // Edita localmente, como a UI faria via `SyncingDietRepository` (save +
    // markPending) — logo depois do restore, antes de qualquer sync rodar.
    const repositories = await getRepositories();
    const restored = await repositories.diets.getById(diet.id);
    await repositories.diets.save({ ...restored!, name: "Editada pós-restore" }, restored!.updatedAt);
    const dbForTracker = await openDatabase(DATABASE_NAME, MIGRATIONS);
    const tracker = new IndexedDbStore<SyncTracker>(dbForTracker, SYNC_TRACKER_STORE.name);
    const { markPending } = await import("@/core/sync/sync-tracker");
    await markPending(tracker, "diets", diet.id);

    // `markPending` preserva o `serverUpdatedAt` que já estava lá — que o
    // reset do import já tinha zerado para `null`. Continua correto: a
    // edição também não descende de nenhuma versão confiável do servidor.
    expect((await trackerEntry(diet.id))?.serverUpdatedAt).toBeNull();

    const server = new FakeServer();
    const push = await pushAllDiets(client(server), tracker, repositories.diets);
    expect(push).toMatchObject({ status: "done", pushed: [diet.id] });
    expect(server.row(diet.id)?.payload.name).toBe("Editada pós-restore");
  });

  it("Caso 9 — dois imports consecutivos: o segundo reflete só o que o segundo backup tem, sem entrada fantasma do primeiro", async () => {
    const first = createDiet("Primeiro import");
    await saveDiet(first);
    const firstBackup = await exportAll();

    await clearAllStores();
    const second = createDiet("Segundo import");
    await saveDiet(second);
    const secondBackup = await exportAll();

    await clearAllStores();
    await importAll(firstBackup);
    await importAll(secondBackup);

    // O primeiro import não sobrevive ao segundo (substitui, nunca mescla) —
    // e sua entrada de tracker devia ter virado "pending" (exclusão) na hora
    // do segundo import, nunca ficar como se nada tivesse mudado.
    expect(await localDiet(first.id)).toBeUndefined();
    expect((await trackerEntry(first.id))?.status).toBe("pending");

    expect((await localDiet(second.id))?.name).toBe("Segundo import");
    expect((await trackerEntry(second.id))?.status).toBe("pending");
    expect((await trackerEntry(second.id))?.serverUpdatedAt).toBeNull();
  });
});
