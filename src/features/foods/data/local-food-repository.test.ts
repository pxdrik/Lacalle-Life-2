import { beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { MemoryStore } from "@/core/storage/memory-store";
import type { Migration } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import type { Food } from "../types/food";
import type { FoodRepository } from "./food-repository";
import { FOODS_STORE } from "./food-store";
import { LocalFoodRepository } from "./local-food-repository";

/**
 * Run against both adapters. The repository's contract — locale-aware
 * ordering above all — must hold regardless of what is underneath, and only
 * the IndexedDB run proves it survives a database that sorts by code unit.
 */
const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "foods", createStores: [FOODS_STORE] },
];

let counter = 0;

const ADAPTERS: readonly { name: string; create: () => Promise<Store<Food>> }[] =
  [
    {
      name: "memory",
      create: () => Promise.resolve(new MemoryStore<Food>(FOODS_STORE)),
    },
    {
      name: "indexeddb",
      create: async () => {
        counter += 1;
        const db = await openDatabase(`foods-repo-${counter}`, MIGRATIONS);
        return new IndexedDbStore<Food>(db, FOODS_STORE.name);
      },
    },
  ];

function food(name: string, isCustom = false): Food {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    category: "protein",
    per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
    isCustom,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe.each(ADAPTERS)("LocalFoodRepository — $name", ({ create }) => {
  let repository: FoodRepository;

  beforeEach(async () => {
    repository = new LocalFoodRepository(await create());
  });

  it("starts empty", async () => {
    await expect(repository.isEmpty()).resolves.toBe(true);
    await expect(repository.listAll()).resolves.toEqual([]);
  });

  it("stops being empty once something is saved", async () => {
    await repository.save(food("Ovo"));

    await expect(repository.isEmpty()).resolves.toBe(false);
  });

  it("round-trips a food by id", async () => {
    const ovo = food("Ovo");
    await repository.save(ovo);

    await expect(repository.getById(ovo.id)).resolves.toEqual(ovo);
  });

  it("returns undefined for an unknown id", async () => {
    await expect(repository.getById("nope")).resolves.toBeUndefined();
  });

  it("removes a food", async () => {
    const ovo = food("Ovo");
    await repository.save(ovo);
    await repository.remove(ovo.id);

    await expect(repository.isEmpty()).resolves.toBe(true);
  });

  describe("ordering", () => {
    it("sorts by name", async () => {
      await repository.saveMany([food("Ovo"), food("Arroz"), food("Feijão")]);

      const names = (await repository.listAll()).map((f) => f.name);
      expect(names).toEqual(["Arroz", "Feijão", "Ovo"]);
    });

    it("places accented names where a reader expects them, not after Z", async () => {
      // Byte ordering would put "Açúcar" and "Óleo" at the end, because their
      // code units are above "z". This is the behaviour the repository exists
      // to guarantee.
      await repository.saveMany([
        food("Zucchini"),
        food("Açúcar"),
        food("Abacate"),
        food("Óleo de oliva"),
        food("Ovo"),
      ]);

      const names = (await repository.listAll()).map((f) => f.name);
      expect(names).toEqual([
        "Abacate",
        "Açúcar",
        "Óleo de oliva",
        "Ovo",
        "Zucchini",
      ]);
    });
  });

  it("keeps custom foods alongside catalogue ones", async () => {
    await repository.saveMany([food("Arroz"), food("Bolo da vó", true)]);

    const all = await repository.listAll();
    expect(all.map((f) => f.isCustom)).toEqual([false, true]);
  });

  describe("forward compatibility", () => {
    it("fills in a field a record predates", async () => {
      // A browser that installed an older version holds records without
      // `isFavorite`. Reading must not hand the app an undefined.
      const legacy = food("Arroz");
      const withoutFavorite: Record<string, unknown> = { ...legacy };
      delete withoutFavorite["isFavorite"];

      await repository.save(withoutFavorite as unknown as Food);

      const [stored] = await repository.listAll();
      expect(stored?.isFavorite).toBe(false);
    });
  });
});
