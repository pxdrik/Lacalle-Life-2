import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import {
  backfillUntracked,
  markClean,
  markConflict,
  markPending,
  SYNC_TRACKER_STORE,
  trackerId,
  type SyncTracker,
} from "./sync-tracker";

function tracker() {
  return new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
}

/**
 * Achado ao vivo contra produção (02/09/2026): uma rotina salva antes do
 * sync de `Routine` existir nunca ganhou entrada no tracker, então nenhum
 * push jamais a via — `listPending` só enxerga o que já está `"pending"`, e
 * um id sem entrada nenhuma não é nada. `backfillUntracked` é a correção:
 * roda uma vez por sessão em `composition/data-providers.tsx`, marcando
 * pendente todo id local sem contrapartida no tracker.
 */
describe("backfillUntracked", () => {
  it("marca pendente um id sem entrada nenhuma no tracker", async () => {
    const t = tracker();

    await backfillUntracked(t, "routines", ["r1"]);

    const entry = await t.get(trackerId("routines", "r1"));
    expect(entry?.status).toBe("pending");
  });

  it("nunca toca um id já clean", async () => {
    const t = tracker();
    await markClean(t, "routines", "r1", "2026-09-01T00:00:00Z");

    await backfillUntracked(t, "routines", ["r1"]);

    const entry = await t.get(trackerId("routines", "r1"));
    expect(entry?.status).toBe("clean");
    expect(entry?.serverUpdatedAt).toBe("2026-09-01T00:00:00Z");
  });

  it("nunca toca um id já pending", async () => {
    const t = tracker();
    await markPending(t, "routines", "r1");
    const before = await t.get(trackerId("routines", "r1"));

    await backfillUntracked(t, "routines", ["r1"]);

    const after = await t.get(trackerId("routines", "r1"));
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.updatedAt).toBe(before?.updatedAt);
  });

  it("nunca toca um id em conflito", async () => {
    const t = tracker();
    await markConflict(t, "routines", "r1", "2026-09-01T00:00:00Z");

    await backfillUntracked(t, "routines", ["r1"]);

    const entry = await t.get(trackerId("routines", "r1"));
    expect(entry?.status).toBe("conflict");
  });

  it("processa uma lista mista sem cruzar stores diferentes", async () => {
    const t = tracker();
    await markClean(t, "routines", "r1", "2026-09-01T00:00:00Z");

    await backfillUntracked(t, "routines", ["r1", "r2", "r3"]);
    await backfillUntracked(t, "diets", ["r2"]);

    expect((await t.get(trackerId("routines", "r1")))?.status).toBe("clean");
    expect((await t.get(trackerId("routines", "r2")))?.status).toBe("pending");
    expect((await t.get(trackerId("routines", "r3")))?.status).toBe("pending");
    expect((await t.get(trackerId("diets", "r2")))?.status).toBe("pending");
  });
});
