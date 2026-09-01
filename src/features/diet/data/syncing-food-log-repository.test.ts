import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";

import { FOOD_LOGS_STORE } from "./food-log-repository";
import { LocalFoodLogRepository } from "./local-food-log-repository";
import { SyncingFoodLogRepository } from "./syncing-food-log-repository";
import type { FoodLog } from "../types/food-log";

/**
 * `onPending` é a ponte para `composition/sync` tentar um push logo depois
 * de salvar/apagar — mesmo achado de `SyncingProfileRepository`. Recebe o
 * dia, não é sem parâmetro como os outros `Syncing*Repository` — ver a doc
 * da classe para o motivo. Estes testes provam só o chamado do gancho, não
 * o push em si (coberto por `food-log-sync.test.ts`).
 */

function log(day = "2026-08-25"): FoodLog {
  return { id: day, day, meals: [], dietId: null, createdAt: 1000, updatedAt: 1000 };
}

function mount(onPending?: (day: string) => void) {
  const local = new LocalFoodLogRepository(new MemoryStore<FoodLog>(FOOD_LOGS_STORE));
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  return new SyncingFoodLogRepository(local, tracker, onPending);
}

describe("SyncingFoodLogRepository — gancho onPending", () => {
  it("chama onPending com o dia depois de save", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);

    await repository.save(log("2026-08-25"), null);

    expect(onPending).toHaveBeenCalledTimes(1);
    expect(onPending).toHaveBeenCalledWith("2026-08-25");
  });

  it("chama onPending com o dia depois de remove", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);
    await repository.save(log("2026-08-25"), null);
    onPending.mockClear();

    await repository.remove("2026-08-25");

    expect(onPending).toHaveBeenCalledTimes(1);
    expect(onPending).toHaveBeenCalledWith("2026-08-25");
  });

  it("nunca lança e o registro local é gravado normalmente sem onPending", async () => {
    const repository = mount();

    await expect(repository.save(log("2026-08-25"), null)).resolves.toBeUndefined();
    await expect(repository.getByDay("2026-08-25")).resolves.toMatchObject({
      day: "2026-08-25",
    });
  });
});
