import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";

import { createWaterEntry } from "../services/hydration-log";
import type { WaterEntry } from "../types/water-entry";
import { LocalWaterRepository } from "./local-water-repository";
import { SyncingWaterRepository } from "./syncing-water-repository";
import { WATER_ENTRIES_STORE } from "./water-repository";

/**
 * `onPending` é a ponte para `composition/sync` tentar um push logo depois
 * de salvar/apagar — mesmo achado de `SyncingDietRepository`. Estes testes
 * provam só o chamado do gancho, não o push em si (coberto por
 * `water-entry-sync.test.ts`, se um dia existir — hoje coberto ao vivo).
 */

function mount(onPending?: () => void) {
  const local = new LocalWaterRepository(
    new MemoryStore<WaterEntry>(WATER_ENTRIES_STORE),
  );
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  return new SyncingWaterRepository(local, tracker, onPending);
}

describe("SyncingWaterRepository — gancho onPending", () => {
  it("chama onPending depois de save", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);

    await repository.save(createWaterEntry("2026-09-24"), null);

    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it("chama onPending depois de remove", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);
    await repository.save(createWaterEntry("2026-09-24"), null);
    onPending.mockClear();

    await repository.remove("2026-09-24");

    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it("nunca lança e o registro local é gravado normalmente sem onPending", async () => {
    const repository = mount();
    const entry = { ...createWaterEntry("2026-09-24"), ml: 500 };

    await expect(repository.save(entry, null)).resolves.toBeUndefined();
    await expect(repository.getByDay("2026-09-24")).resolves.toMatchObject({
      ml: 500,
    });
  });
});
