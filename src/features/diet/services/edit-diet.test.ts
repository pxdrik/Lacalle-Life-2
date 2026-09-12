import { describe, expect, it } from "vitest";

import { createDiet, createMealItem } from "./create-diet";
import {
  addItem,
  addMeal,
  applyMealAlternative,
  removeItem,
  removeMeal,
  removeMealAlternative,
  renameDiet,
  renameMealAlternative,
  saveMealAsAlternative,
  setItemGrams,
  updateMeal,
} from "./edit-diet";

const CHICKEN = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };

function dietWithFood() {
  const diet = createDiet("Cutting");
  const mealId = diet.meals[0]!.id;
  const item = createMealItem({
    foodId: "peito-de-frango-grelhado",
    name: "Peito de frango grelhado",
    grams: 150,
    per100g: CHICKEN,
  });

  return { diet: addItem(diet, mealId, item), mealId, itemId: item.id };
}

describe("createDiet", () => {
  it("starts with exactly one meal, so the next click adds food", () => {
    expect(createDiet("Cutting").meals).toHaveLength(1);
  });

  it("trims the name", () => {
    expect(createDiet("  Cutting  ").name).toBe("Cutting");
  });

  it("gives distinct ids to distinct diets", () => {
    expect(createDiet("A").id).not.toBe(createDiet("B").id);
  });
});

describe("createMealItem", () => {
  it("copies the food's values instead of referencing them", () => {
    const item = createMealItem({
      foodId: "ovo",
      name: "Ovo",
      grams: 50,
      per100g: CHICKEN,
    });

    // The copy is the whole point: correcting or deleting the catalogue entry
    // afterwards must not rewrite a plan the user already built.
    expect(item.per100g).toEqual(CHICKEN);
    expect(item.foodId).toBe("ovo");
  });
});

describe("meals", () => {
  it("appends a meal", () => {
    const diet = addMeal(createDiet("Cutting"));

    expect(diet.meals).toHaveLength(2);
    expect(diet.meals[1]?.name).toBe("Refeição 2");
  });

  it("removes a meal", () => {
    const diet = addMeal(createDiet("Cutting"));
    const without = removeMeal(diet, diet.meals[0]!.id);

    expect(without.meals).toHaveLength(1);
    expect(without.meals[0]?.id).toBe(diet.meals[1]?.id);
  });

  it("renames a meal without touching the others", () => {
    const diet = addMeal(createDiet("Cutting"));
    const updated = updateMeal(diet, diet.meals[0]!.id, { name: "Café" });

    expect(updated.meals[0]?.name).toBe("Café");
    expect(updated.meals[1]?.name).toBe("Refeição 2");
  });

  it("distinguishes no fixed time from midnight", () => {
    const diet = createDiet("Cutting");
    const withTime = updateMeal(diet, diet.meals[0]!.id, { time: "07:30" });
    const without = updateMeal(withTime, diet.meals[0]!.id, { time: null });

    expect(withTime.meals[0]?.time).toBe("07:30");
    expect(without.meals[0]?.time).toBeNull();
  });
});

describe("items", () => {
  it("adds a food to a meal", () => {
    const { diet, mealId } = dietWithFood();

    expect(diet.meals.find((m) => m.id === mealId)?.items).toHaveLength(1);
  });

  it("changes a portion", () => {
    const { diet, mealId, itemId } = dietWithFood();
    const updated = setItemGrams(diet, mealId, itemId, 200);

    expect(updated.meals[0]?.items[0]?.grams).toBe(200);
  });

  it("removes an item", () => {
    const { diet, mealId, itemId } = dietWithFood();

    expect(removeItem(diet, mealId, itemId).meals[0]?.items).toHaveLength(0);
  });
});

describe("meal alternatives", () => {
  const RICE = { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };

  function dietWithAlternative() {
    const { diet, mealId } = dietWithFood();
    const withAlternative = saveMealAsAlternative(
      diet,
      mealId,
      "Marmita de frango",
    );
    const alternativeId = withAlternative.meals[0]!.alternatives![0]!.id;

    return { diet: withAlternative, mealId, alternativeId };
  }

  it("has no alternatives until one is saved", () => {
    const { diet } = dietWithFood();

    expect(diet.meals[0]?.alternatives).toBeUndefined();
  });

  it("saves the current foods under a name, with fresh ids", () => {
    const { diet, mealId, itemId } = dietWithFood();
    const saved = saveMealAsAlternative(diet, mealId, "Marmita de frango");

    const alternative = saved.meals[0]!.alternatives![0]!;
    expect(alternative.name).toBe("Marmita de frango");
    expect(alternative.items.map((item) => item.name)).toEqual([
      "Peito de frango grelhado",
    ]);
    expect(alternative.items[0]?.id).not.toBe(itemId);
  });

  it("trims the name and refuses an empty one", () => {
    const { diet, mealId } = dietWithFood();

    expect(saveMealAsAlternative(diet, mealId, "  Arroz  ").meals[0]
      ?.alternatives?.[0]?.name).toBe("Arroz");
    expect(saveMealAsAlternative(diet, mealId, "   ")).toBe(diet);
  });

  it("appends rather than replacing an earlier suggestion", () => {
    const { diet, mealId } = dietWithAlternative();
    const withSecond = saveMealAsAlternative(diet, mealId, "Marmita de arroz");

    expect(withSecond.meals[0]?.alternatives?.map((a) => a.name)).toEqual([
      "Marmita de frango",
      "Marmita de arroz",
    ]);
  });

  it("does not touch the live items when saving", () => {
    const { diet, mealId, itemId } = dietWithFood();
    const saved = saveMealAsAlternative(diet, mealId, "Marmita de frango");

    expect(saved.meals[0]?.items[0]?.id).toBe(itemId);
  });

  it("swaps the live foods for the saved suggestion", () => {
    let diet = createDiet("Cutting");
    const mealId = diet.meals[0]!.id;
    diet = addItem(
      diet,
      mealId,
      createMealItem({
        foodId: "frango",
        name: "Frango",
        grams: 150,
        per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      }),
    );
    const withAlternative = saveMealAsAlternative(diet, mealId, "Frango");
    diet = addItem(
      withAlternative,
      mealId,
      createMealItem({
        foodId: "arroz",
        name: "Arroz",
        grams: 100,
        per100g: RICE,
      }),
    );
    const alternativeId = diet.meals[0]!.alternatives![0]!.id;

    const swapped = applyMealAlternative(diet, mealId, alternativeId);

    expect(swapped.meals[0]?.items.map((item) => item.name)).toEqual([
      "Frango",
    ]);
  });

  it("gives swapped-in items fresh ids", () => {
    const { diet, mealId, alternativeId } = dietWithAlternative();
    const savedItemId = diet.meals[0]!.alternatives![0]!.items[0]!.id;

    const swapped = applyMealAlternative(diet, mealId, alternativeId);

    expect(swapped.meals[0]?.items[0]?.id).not.toBe(savedItemId);
  });

  it("leaves the saved suggestion alone after swapping and re-editing", () => {
    const { diet, mealId, alternativeId } = dietWithAlternative();
    const swapped = applyMealAlternative(diet, mealId, alternativeId);
    const edited = setItemGrams(
      swapped,
      mealId,
      swapped.meals[0]!.items[0]!.id,
      999,
    );

    expect(edited.meals[0]?.alternatives?.[0]?.items[0]?.grams).toBe(150);
  });

  it("renames a saved suggestion", () => {
    const { diet, mealId, alternativeId } = dietWithAlternative();
    const renamed = renameMealAlternative(
      diet,
      mealId,
      alternativeId,
      "Marmita de frango grelhado",
    );

    expect(renamed.meals[0]?.alternatives?.[0]?.name).toBe(
      "Marmita de frango grelhado",
    );
  });

  it("removes a saved suggestion", () => {
    const { diet, mealId, alternativeId } = dietWithAlternative();

    expect(
      removeMealAlternative(diet, mealId, alternativeId).meals[0]
        ?.alternatives,
    ).toHaveLength(0);
  });

  it("ignores an unknown meal or suggestion", () => {
    const { diet, mealId, alternativeId } = dietWithAlternative();

    expect(saveMealAsAlternative(diet, "gone", "X")).toBe(diet);
    expect(applyMealAlternative(diet, mealId, "gone")).toBe(diet);
    expect(applyMealAlternative(diet, "gone", alternativeId)).toBe(diet);
    expect(renameMealAlternative(diet, mealId, "gone", "X")).toBe(diet);
    expect(removeMealAlternative(diet, mealId, "gone")).toBe(diet);
  });
});

describe("stale references", () => {
  // The UI addresses meals and items by id and can be a frame behind the data,
  // so a click on something already gone must be a no-op, not a crash.
  it("ignores an unknown meal and reports no write", () => {
    const diet = createDiet("Cutting");

    expect(updateMeal(diet, "gone", { name: "x" })).toBe(diet);
    expect(removeMeal(diet, "gone").meals).toHaveLength(1);
  });

  it("ignores an unknown item", () => {
    const { diet, mealId } = dietWithFood();

    expect(removeItem(diet, mealId, "gone").meals[0]?.items).toHaveLength(1);
    expect(
      setItemGrams(diet, mealId, "gone", 500).meals[0]?.items[0]?.grams,
    ).toBe(150);
  });
});

describe("updatedAt", () => {
  it("advances on a real edit", () => {
    const diet = createDiet("Cutting");
    const renamed = renameDiet(diet, "Bulking");

    expect(renamed.updatedAt).toBeGreaterThanOrEqual(diet.updatedAt);
    expect(renamed.createdAt).toBe(diet.createdAt);
  });

  it("does not advance when nothing was found to change", () => {
    const diet = createDiet("Cutting");

    // Returning the same reference is what lets the editor skip a pointless
    // write, and keeps a no-op from looking like an edit to a future sync.
    expect(updateMeal(diet, "gone", { name: "x" })).toBe(diet);
  });
});

describe("immutability", () => {
  it("never mutates the diet it was given", () => {
    const diet = createDiet("Cutting");
    const snapshot = structuredClone(diet);

    addMeal(diet);
    renameDiet(diet, "Other");
    removeMeal(diet, diet.meals[0]!.id);

    expect(diet).toEqual(snapshot);
  });
});
