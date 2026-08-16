import { beforeEach, describe, expect, it } from "vitest";

import { revise } from "@/core/domain/entity";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { MemoryStore } from "@/core/storage/memory-store";
import type { Migration } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import { createDiet, createMealItem } from "../services/create-diet";
import { addItem } from "../services/edit-diet";
import type { Diet } from "../types/diet";
import type { DietRepository } from "./diet-repository";
import { DIETS_STORE } from "./diet-store";
import { LocalDietRepository } from "./local-diet-repository";

const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "diets", createStores: [DIETS_STORE] },
];

let counter = 0;

const ADAPTERS: readonly {
  name: string;
  create: () => Promise<Store<Diet>>;
}[] = [
  {
    name: "memory",
    create: () => Promise.resolve(new MemoryStore<Diet>(DIETS_STORE)),
  },
  {
    name: "indexeddb",
    create: async () => {
      counter += 1;
      const db = await openDatabase(`diets-repo-${counter}`, MIGRATIONS);
      return new IndexedDbStore<Diet>(db, DIETS_STORE.name);
    },
  },
];

const at = (diet: Diet, updatedAt: number): Diet => ({ ...diet, updatedAt });

describe.each(ADAPTERS)("LocalDietRepository — $name", ({ create }) => {
  let repository: DietRepository;

  beforeEach(async () => {
    repository = new LocalDietRepository(await create());
  });

  it("starts empty", async () => {
    await expect(repository.listAll()).resolves.toEqual([]);
  });

  it("round-trips a diet", async () => {
    const diet = createDiet("Cutting");
    await repository.save(diet, null);

    await expect(repository.getById(diet.id)).resolves.toEqual(diet);
  });

  it("returns undefined for an unknown id", async () => {
    await expect(repository.getById("nope")).resolves.toBeUndefined();
  });

  it("stores meals and items nested inside the diet", async () => {
    let diet = createDiet("Cutting");
    diet = addItem(
      diet,
      diet.meals[0]!.id,
      createMealItem({
        foodId: "ovo",
        name: "Ovo",
        grams: 50,
        per100g: { kcal: 143, proteinG: 13, carbsG: 1, fatG: 10 },
      }),
    );

    await repository.save(diet, null);
    const stored = await repository.getById(diet.id);

    // One document in, one document out — the aggregate cannot come back
    // half-assembled.
    expect(stored?.meals[0]?.items[0]).toMatchObject({
      name: "Ovo",
      grams: 50,
    });
  });

  it("lists the most recently edited first", async () => {
    await repository.save(at(createDiet("Antiga"), 1_000), null);
    await repository.save(at(createDiet("Recente"), 3_000), null);
    await repository.save(at(createDiet("Média"), 2_000), null);

    const names = (await repository.listAll()).map((d) => d.name);
    expect(names).toEqual(["Recente", "Média", "Antiga"]);
  });

  it("replaces on save to an existing id", async () => {
    const diet = createDiet("Cutting");
    await repository.save(diet, null);
    await repository.save({ ...diet, name: "Bulking" }, diet.updatedAt);

    const all = await repository.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe("Bulking");
  });

  it("removes a diet", async () => {
    const diet = createDiet("Cutting");
    await repository.save(diet, null);
    await repository.remove(diet.id);

    await expect(repository.listAll()).resolves.toEqual([]);
  });

  describe("concurrent writers — BUG-001", () => {
    it("rejects a stale writer instead of silently overwriting the winner", async () => {
      const original = createDiet("Cutting");
      await repository.save(original, null);

      // Two tabs open the same diet and both read version `original.updatedAt`.
      const fromTabA = revise(original, { name: "Renamed by A" });
      const fromTabB = revise(original, { name: "Renamed by B" });

      // Tab A saves first.
      await repository.save(fromTabA, original.updatedAt);

      // Tab B still believes the version it originally read — its write must
      // be rejected, not silently win over Tab A's.
      await expect(
        repository.save(fromTabB, original.updatedAt),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const stored = await repository.getById(original.id);
      expect(stored?.name).toBe("Renamed by A");
    });

    it("accepts a create with expected version null, rejects a second create at the same id", async () => {
      const diet = createDiet("Bulking");

      await repository.save(diet, null);
      await expect(repository.save(diet, null)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });

    it("lets a valid sequence of successive updates through", async () => {
      const diet = createDiet("Cutting");
      await repository.save(diet, null);

      const v2 = revise(diet, { name: "v2" });
      await repository.save(v2, diet.updatedAt);

      const v3 = revise(v2, { name: "v3" });
      await repository.save(v3, v2.updatedAt);

      await expect(repository.getById(diet.id)).resolves.toMatchObject({
        name: "v3",
      });
    });
  });
});
