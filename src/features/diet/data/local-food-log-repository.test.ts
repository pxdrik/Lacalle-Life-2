import { beforeEach, describe, expect, it } from "vitest";

import { DataError } from "@/core/domain/data-error";
import { revise } from "@/core/domain/entity";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { MemoryStore } from "@/core/storage/memory-store";
import type { Migration } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import { createFoodLog } from "../services/start-day";
import type { FoodLog } from "../types/food-log";
import { FOOD_LOGS_STORE } from "./food-log-repository";
import { LocalFoodLogRepository } from "./local-food-log-repository";

const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "food logs", createStores: [FOOD_LOGS_STORE] },
];

let counter = 0;

const ADAPTERS: readonly {
  name: string;
  create: () => Promise<Store<FoodLog>>;
}[] = [
  {
    name: "memory",
    create: () => Promise.resolve(new MemoryStore<FoodLog>(FOOD_LOGS_STORE)),
  },
  {
    name: "indexeddb",
    create: async () => {
      counter += 1;
      const db = await openDatabase(`food-logs-repo-${counter}`, MIGRATIONS);
      return new IndexedDbStore<FoodLog>(db, FOOD_LOGS_STORE.name);
    },
  },
];

describe.each(ADAPTERS)("LocalFoodLogRepository — $name", ({ create }) => {
  let repository: LocalFoodLogRepository;

  beforeEach(async () => {
    repository = new LocalFoodLogRepository(await create());
  });

  describe("concurrent writers — BUG-001", () => {
    it("rejects a stale writer instead of silently overwriting the winner", async () => {
      const original = createFoodLog("2026-08-16");
      await repository.save(original, null);

      // Two tabs open the same day and both read `original.updatedAt`.
      const fromTabA = revise(original, {
        meals: [
          {
            id: "m1",
            name: "Café da manhã (A)",
            time: null,
            notes: "",
            items: [],
          },
        ],
      });
      const fromTabB = revise(original, {
        meals: [
          {
            id: "m1",
            name: "Café da manhã (B)",
            time: null,
            notes: "",
            items: [],
          },
        ],
      });

      await repository.save(fromTabA, original.updatedAt);

      await expect(
        repository.save(fromTabB, original.updatedAt),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const stored = await repository.getByDay("2026-08-16");
      expect(stored?.meals[0]?.name).toBe("Café da manhã (A)");
    });

    it("rejects a second create at the same day", async () => {
      const log = createFoodLog("2026-08-16");

      await repository.save(log, null);
      await expect(repository.save(log, null)).rejects.toBeInstanceOf(
        DataError,
      );
    });

    it("lets a valid sequence of successive updates through", async () => {
      const log = createFoodLog("2026-08-16");
      await repository.save(log, null);

      const v2 = revise(log, { dietId: "diet-1" });
      await repository.save(v2, log.updatedAt);

      const v3 = revise(v2, { dietId: "diet-2" });
      await repository.save(v3, v2.updatedAt);

      await expect(repository.getByDay("2026-08-16")).resolves.toMatchObject({
        dietId: "diet-2",
      });
    });

    it("a conflicting write against a deleted day is rejected, not resurrected", async () => {
      const log = createFoodLog("2026-08-16");
      await repository.save(log, null);
      await repository.remove(log.id);

      // A stale tab still believes the day exists at the version it read.
      await expect(
        repository.save(revise(log, { dietId: "diet-1" }), log.updatedAt),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      await expect(repository.getByDay("2026-08-16")).resolves.toBeUndefined();
    });
  });
});
