import { describe, expect, it } from "vitest";

import { createDiet, createMealItem } from "./create-diet";
import { addItem, setItemGrams } from "./edit-diet";
import { startDayFromDiet, createFoodLog } from "./start-day";
import { isEmptyLog } from "../types/food-log";
import type { Diet } from "../types/diet";

const PER_100G = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };

function dietWithLunch(): Diet {
  // `createDiet` already opens with one meal; adding another would make the
  // counts below say something other than what they mean.
  let diet = createDiet("Cutting");
  const meal = diet.meals[0]!;

  diet = addItem(
    diet,
    meal.id,
    createMealItem({
      foodId: "frango",
      name: "Peito de frango",
      grams: 200,
      per100g: PER_100G,
    }),
  );

  return diet;
}

describe("createFoodLog", () => {
  it("uses the day as the id, so one Tuesday cannot be logged twice", () => {
    const log = createFoodLog("2026-08-07");

    expect(log.id).toBe("2026-08-07");
    expect(log.day).toBe("2026-08-07");
    expect(isEmptyLog(log)).toBe(true);
  });
});

describe("startDayFromDiet", () => {
  it("copies the meals and what was in them", () => {
    const log = startDayFromDiet(dietWithLunch(), "2026-08-07");

    expect(log.meals).toHaveLength(1);
    expect(log.meals[0]?.items[0]).toMatchObject({
      name: "Peito de frango",
      grams: 200,
      per100g: PER_100G,
    });
  });

  it("shares no id with the diet, at any depth", () => {
    // This is what makes the two independent structurally rather than by a
    // rule somebody has to remember. If any id were shared, an edit on one
    // side could be made to reach the other.
    const diet = dietWithLunch();
    const log = startDayFromDiet(diet, "2026-08-07");

    const dietIds = new Set([
      diet.id,
      ...diet.meals.flatMap((meal) => [
        meal.id,
        ...meal.items.map((i) => i.id),
      ]),
    ]);
    const logIds = [
      ...log.meals.flatMap((meal) => [meal.id, ...meal.items.map((i) => i.id)]),
    ];

    for (const id of logIds) expect(dietIds.has(id)).toBe(false);
  });

  it("keeps the foodId, which is a reference and not a copy", () => {
    // The food is shared ground; the *portion* is what was eaten.
    const log = startDayFromDiet(dietWithLunch(), "2026-08-07");

    expect(log.meals[0]?.items[0]?.foodId).toBe("frango");
  });

  it("stamps every copied meal with where it came from", () => {
    // Same pair `checkMeal` stamps for a single meal — starting the whole day
    // this way means every meal in it should already read as checked.
    const diet = dietWithLunch();
    const log = startDayFromDiet(diet, "2026-08-07");

    expect(log.meals[0]).toMatchObject({
      sourceDietId: diet.id,
      sourceMealId: diet.meals[0]!.id,
    });
  });

  it("records which diet the day came from", () => {
    const diet = dietWithLunch();

    expect(startDayFromDiet(diet, "2026-08-07").dietId).toBe(diet.id);
  });

  it("leaves the diet untouched when the day is edited afterwards", () => {
    // The whole point: correcting Tuesday's portion must not rewrite the plan.
    const diet = dietWithLunch();
    const log = startDayFromDiet(diet, "2026-08-07");
    const mealId = log.meals[0]!.id;
    const itemId = log.meals[0]!.items[0]!.id;

    const eaten = setItemGrams(log, mealId, itemId, 250);

    expect(eaten.meals[0]?.items[0]?.grams).toBe(250);
    expect(diet.meals[0]?.items[0]?.grams).toBe(200);
  });
});
