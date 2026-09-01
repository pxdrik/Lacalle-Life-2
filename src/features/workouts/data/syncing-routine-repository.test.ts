import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";

import { LocalRoutineRepository, ROUTINES_STORE } from "./routine-repository";
import { SyncingRoutineRepository } from "./syncing-routine-repository";
import type { Routine } from "../types/routine";

/**
 * `onPending` é a ponte para `composition/sync` tentar um push logo depois
 * de salvar/apagar — o caso que expôs o problema (ver a doc da classe).
 * Estes testes provam só o chamado do gancho, não o push em si (coberto
 * por `routine-sync.test.ts`).
 */

function routine(id = "rotina-1"): Routine {
  return { id, name: "Upper", notes: "", exercises: [], createdAt: 1000, updatedAt: 1000 };
}

function mount(onPending?: () => void) {
  const local = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  return new SyncingRoutineRepository(local, tracker, onPending);
}

describe("SyncingRoutineRepository — gancho onPending", () => {
  it("chama onPending depois de save", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);

    await repository.save(routine(), null);

    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it("chama onPending depois de remove", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);
    await repository.save(routine(), null);
    onPending.mockClear();

    await repository.remove("rotina-1");

    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it("nunca lança e o registro local é gravado normalmente sem onPending", async () => {
    const repository = mount();

    await expect(repository.save(routine(), null)).resolves.toBeUndefined();
    await expect(repository.getById("rotina-1")).resolves.toMatchObject({ name: "Upper" });
  });
});
