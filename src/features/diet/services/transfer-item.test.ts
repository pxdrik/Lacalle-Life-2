import { describe, expect, it, vi } from "vitest";

import { DataError } from "@/core/domain/data-error";
import { MemoryStore } from "@/core/storage/memory-store";

import type { DietRepository } from "../data/diet-repository";
import { DIETS_STORE } from "../data/diet-store";
import { LocalDietRepository } from "../data/local-diet-repository";
import { createDiet, createMealItem } from "./create-diet";
import { addMeal } from "./edit-diet";
import { transferItemToDiet } from "./transfer-item";
import type { Diet } from "../types/diet";

function repository() {
  return new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
}

const ITEM = createMealItem({
  foodId: "abacate",
  name: "Abacate",
  grams: 100,
  per100g: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 },
});

describe("transferItemToDiet", () => {
  it("adds a copy of the item to the target diet's meal", async () => {
    const repo = repository();
    const target = createDiet("Treino de corte");
    await repo.save(target, null);

    const result = await transferItemToDiet(
      repo,
      target.id,
      target.meals[0]!.id,
      ITEM,
    );

    expect(result).toEqual({ ok: true });
    const stored = await repo.getById(target.id);
    expect(stored?.meals[0]?.items).toHaveLength(1);
    expect(stored?.meals[0]?.items[0]?.name).toBe("Abacate");
  });

  it("mints a fresh id, so adjusting it in the target diet never moves the original", async () => {
    const repo = repository();
    const target = createDiet("Treino de corte");
    await repo.save(target, null);

    await transferItemToDiet(repo, target.id, target.meals[0]!.id, ITEM);

    const stored = await repo.getById(target.id);
    expect(stored?.meals[0]?.items[0]?.id).not.toBe(ITEM.id);
  });

  it("reads the diet fresh rather than a snapshot from when it was first loaded", async () => {
    const repo = repository();
    const original = createDiet("Treino de corte");
    await repo.save(original, null);

    // A second meal, added and saved after `original` was captured — this
    // function only ever receives the diet's id, so landing the item in
    // this meal is only possible by reading the diet again itself.
    const withSecondMeal = addMeal(original);
    await repo.save(withSecondMeal, original.updatedAt);
    const newMealId = withSecondMeal.meals[1]!.id;

    const result = await transferItemToDiet(
      repo,
      original.id,
      newMealId,
      ITEM,
    );

    expect(result).toEqual({ ok: true });
    const stored = await repo.getById(original.id);
    expect(stored?.meals[1]?.items).toHaveLength(1);
  });

  it("is a silent no-op when the target diet no longer exists", async () => {
    const repo = repository();

    const result = await transferItemToDiet(
      repo,
      "deleted-diet",
      "some-meal",
      ITEM,
    );

    expect(result).toEqual({ ok: true });
  });

  it("is a silent no-op when the target meal no longer exists in that diet", async () => {
    const repo = repository();
    const target = createDiet("Treino de corte");
    await repo.save(target, null);

    const result = await transferItemToDiet(
      repo,
      target.id,
      "deleted-meal",
      ITEM,
    );

    expect(result).toEqual({ ok: true });
    const stored = await repo.getById(target.id);
    expect(stored?.meals[0]?.items).toHaveLength(0);
  });

  it("reports a conflict as a friendly message instead of throwing", async () => {
    const target = createDiet("Treino de corte");
    // A fake rather than the real repository: reproducing a genuine race
    // between this function's own internal read and write would mean
    // reaching into its internals, which is not this test's business. What
    // matters here is only the contract — a `DataError` from `save` comes
    // back as `{ ok: false, message }`, never as a thrown rejection.
    const fake: DietRepository = {
      listAll: vi.fn(),
      getById: vi.fn().mockResolvedValue(target),
      save: vi
        .fn()
        .mockRejectedValue(
          new DataError("CONFLICT", "Isso foi alterado em outro lugar."),
        ),
      remove: vi.fn(),
    };

    const result = await transferItemToDiet(
      fake,
      target.id,
      target.meals[0]!.id,
      ITEM,
    );

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("alterado em outro lugar"),
    });
  });
});
