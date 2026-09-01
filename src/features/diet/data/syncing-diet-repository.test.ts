import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";

import { DIETS_STORE } from "./diet-store";
import { LocalDietRepository } from "./local-diet-repository";
import { SyncingDietRepository } from "./syncing-diet-repository";
import type { Diet } from "../types/diet";

/**
 * `onPending` é a ponte para `composition/sync` tentar um push logo depois
 * de salvar/apagar — mesmo achado de `SyncingProfileRepository`. Estes
 * testes provam só o chamado do gancho, não o push em si (coberto por
 * `diet-sync.test.ts`).
 */

function diet(id = "dieta-1"): Diet {
  return { id, name: "Dieta", meals: [], weekdays: [], createdAt: 1000, updatedAt: 1000 };
}

function mount(onPending?: () => void) {
  const local = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  return new SyncingDietRepository(local, tracker, onPending);
}

describe("SyncingDietRepository — gancho onPending", () => {
  it("chama onPending depois de save", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);

    await repository.save(diet(), null);

    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it("chama onPending depois de remove", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);
    await repository.save(diet(), null);
    onPending.mockClear();

    await repository.remove("dieta-1");

    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it("nunca lança e o registro local é gravado normalmente sem onPending", async () => {
    const repository = mount();

    await expect(repository.save(diet(), null)).resolves.toBeUndefined();
    await expect(repository.getById("dieta-1")).resolves.toMatchObject({ name: "Dieta" });
  });
});
