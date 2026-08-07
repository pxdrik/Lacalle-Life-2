import { describe, expect, it } from "vitest";

import { createDiet, createMealItem, duplicateDiet, duplicateMeal } from "./create-diet";
import {
  addItem,
  addMeal,
  copyItemToMeal,
  moveItemToMeal,
  setItemGrams,
  updateMeal,
} from "./edit-diet";
import { dietMacros } from "./diet-macros";
import type { Diet } from "../types/diet";

const CHICKEN = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
const RICE = { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };

function fullDiet() {
  let diet = createDiet("Cutting");
  const almoco = diet.meals[0]!.id;
  diet = updateMeal(diet, almoco, { name: "Almoço", time: "12:00" });
  diet = addItem(
    diet,
    almoco,
    createMealItem({ foodId: "frango", name: "Frango", grams: 150, per100g: CHICKEN }),
  );
  diet = addItem(
    diet,
    almoco,
    createMealItem({ foodId: "arroz", name: "Arroz", grams: 100, per100g: RICE }),
  );

  diet = addMeal(diet);
  const jantar = diet.meals[1]!.id;
  diet = updateMeal(diet, jantar, { name: "Jantar" });

  return { diet, almoco, jantar };
}

/** Every id in a diet, at every level. */
function allIds(diet: Diet): string[] {
  return [
    diet.id,
    ...diet.meals.flatMap((meal) => [meal.id, ...meal.items.map((i) => i.id)]),
  ];
}

describe("duplicateDiet", () => {
  it("copies the meals and their foods", () => {
    const { diet } = fullDiet();
    const copy = duplicateDiet(diet);

    expect(copy.meals).toHaveLength(2);
    expect(copy.meals[0]?.items.map((i) => i.name)).toEqual(["Frango", "Arroz"]);
  });

  it("marks the copy in its name, since it sits beside the original", () => {
    const { diet } = fullDiet();

    expect(duplicateDiet(diet).name).toBe("Cutting (cópia)");
  });

  it("shares no id with the original, at any level", () => {
    // The property that matters: reusing ids would make editing one
    // indistinguishable from editing the other to anything addressing by id.
    const { diet } = fullDiet();
    const copy = duplicateDiet(diet);

    const original = new Set(allIds(diet));
    expect(allIds(copy).filter((id) => original.has(id))).toEqual([]);
  });

  it("computes the same totals as the original", () => {
    const { diet } = fullDiet();

    expect(dietMacros(duplicateDiet(diet))).toEqual(dietMacros(diet));
  });

  it("does not change when the original is edited afterwards", () => {
    const { diet, almoco } = fullDiet();
    const copy = duplicateDiet(diet);
    const before = structuredClone(copy);

    const itemId = diet.meals[0]!.items[0]!.id;
    const later = setItemGrams(diet, almoco, itemId, 999);

    expect(later.meals[0]?.items[0]?.grams).toBe(999);
    expect(copy).toEqual(before);
  });

  it("keeps meal names and times", () => {
    const { diet } = fullDiet();
    const copy = duplicateDiet(diet);

    expect(copy.meals[0]).toMatchObject({ name: "Almoço", time: "12:00" });
  });
});

describe("duplicateMeal", () => {
  it("inserts the copy directly below the original", () => {
    const { diet, almoco } = fullDiet();
    const after = duplicateMeal(diet, almoco);

    expect(after.meals.map((m) => m.name)).toEqual(["Almoço", "Almoço", "Jantar"]);
  });

  it("leaves the name alone, unlike a duplicated diet", () => {
    // Inside a document the copy is distinct by position, and someone
    // duplicating "Almoço" is usually about to make it "Jantar".
    const { diet, almoco } = fullDiet();

    expect(duplicateMeal(diet, almoco).meals[1]?.name).toBe("Almoço");
  });

  it("copies the foods with fresh ids", () => {
    const { diet, almoco } = fullDiet();
    const after = duplicateMeal(diet, almoco);

    const originalItems = after.meals[0]!.items.map((i) => i.id);
    const copiedItems = after.meals[1]!.items.map((i) => i.id);

    expect(copiedItems).toHaveLength(2);
    expect(copiedItems.filter((id) => originalItems.includes(id))).toEqual([]);
  });

  it("ignores a meal that is no longer there", () => {
    const { diet } = fullDiet();

    expect(duplicateMeal(diet, "gone")).toBe(diet);
  });

  it("doubles the diet's totals when the only meal is duplicated", () => {
    let diet = createDiet("Cutting");
    const mealId = diet.meals[0]!.id;
    diet = addItem(
      diet,
      mealId,
      createMealItem({ foodId: null, name: "Frango", grams: 100, per100g: CHICKEN }),
    );

    expect(dietMacros(duplicateMeal(diet, mealId)).kcal).toBe(
      dietMacros(diet).kcal * 2,
    );
  });
});

describe("copyItemToMeal", () => {
  it("adds the food to the target and keeps it in the source", () => {
    const { diet, almoco, jantar } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    const after = copyItemToMeal(diet, almoco, itemId, jantar);

    expect(after.meals[0]?.items).toHaveLength(2);
    expect(after.meals[1]?.items.map((i) => i.name)).toEqual(["Frango"]);
  });

  it("gives the copy its own id, so portions move independently", () => {
    const { diet, almoco, jantar } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    const after = copyItemToMeal(diet, almoco, itemId, jantar);
    const copyId = after.meals[1]!.items[0]!.id;
    const adjusted = setItemGrams(after, jantar, copyId, 300);

    expect(copyId).not.toBe(itemId);
    expect(adjusted.meals[0]?.items[0]?.grams).toBe(150);
    expect(adjusted.meals[1]?.items[0]?.grams).toBe(300);
  });

  it("carries the macros, which the item already owns", () => {
    const { diet, almoco, jantar } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    const after = copyItemToMeal(diet, almoco, itemId, jantar);

    expect(after.meals[1]?.items[0]?.per100g).toEqual(CHICKEN);
  });

  it("refuses to copy onto the meal it is already in", () => {
    const { diet, almoco } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    expect(copyItemToMeal(diet, almoco, itemId, almoco)).toBe(diet);
  });

  it("ignores an unknown item or target", () => {
    const { diet, almoco, jantar } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    expect(copyItemToMeal(diet, almoco, "gone", jantar)).toBe(diet);
    expect(copyItemToMeal(diet, almoco, itemId, "gone")).toBe(diet);
  });
});

describe("moveItemToMeal", () => {
  it("removes it from the source and adds it to the target", () => {
    const { diet, almoco, jantar } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    const after = moveItemToMeal(diet, almoco, itemId, jantar);

    expect(after.meals[0]?.items.map((i) => i.name)).toEqual(["Arroz"]);
    expect(after.meals[1]?.items.map((i) => i.name)).toEqual(["Frango"]);
  });

  it("keeps the same id, because it is the same food", () => {
    const { diet, almoco, jantar } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    expect(moveItemToMeal(diet, almoco, itemId, jantar).meals[1]?.items[0]?.id).toBe(
      itemId,
    );
  });

  it("leaves the diet's totals untouched", () => {
    // Moving a food between meals changes nothing about what is eaten.
    const { diet, almoco, jantar } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    expect(dietMacros(moveItemToMeal(diet, almoco, itemId, jantar))).toEqual(
      dietMacros(diet),
    );
  });

  it("refuses to move onto the meal it is already in", () => {
    const { diet, almoco } = fullDiet();
    const itemId = diet.meals[0]!.items[0]!.id;

    expect(moveItemToMeal(diet, almoco, itemId, almoco)).toBe(diet);
  });
});
