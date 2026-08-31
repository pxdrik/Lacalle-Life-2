import { describe, expect, it } from "vitest";

import { createDiet, createMealItem } from "./create-diet";
import { addItem, removeItem, setItemGrams } from "./edit-diet";
import {
  checkMeal,
  isMealChecked,
  mealCheckState,
  toggleMealChecked,
  uncheckMeal,
} from "./meal-execution";
import { createFoodLog, startDayFromDiet } from "./start-day";
import type { Diet } from "../types/diet";

const PER_100G = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };

function dietWithBreakfast(): Diet {
  let diet = createDiet("Cutting");
  const meal = diet.meals[0]!;

  diet = addItem(
    diet,
    meal.id,
    createMealItem({
      foodId: "ovo",
      name: "Ovo",
      grams: 150,
      per100g: PER_100G,
    }),
  );

  return diet;
}

describe("checkMeal", () => {
  it("adds a snapshot of the meal to the log", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const log = checkMeal(createFoodLog("2026-08-31"), diet, meal);

    expect(log.meals).toHaveLength(1);
    expect(log.meals[0]).toMatchObject({
      name: meal.name,
      sourceDietId: diet.id,
      sourceMealId: meal.id,
    });
    expect(log.meals[0]?.items[0]).toMatchObject({
      name: "Ovo",
      grams: 150,
      per100g: PER_100G,
    });
  });

  it("mints fresh ids at every depth, sharing none with the diet", () => {
    // Same guarantee `startDayFromDiet` makes: correcting the diet later must
    // never be able to reach into a day already recorded.
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const log = checkMeal(createFoodLog("2026-08-31"), diet, meal);

    expect(log.meals[0]?.id).not.toBe(meal.id);
    expect(log.meals[0]?.items[0]?.id).not.toBe(meal.items[0]?.id);
  });

  it("is a no-op if the meal is already checked", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const once = checkMeal(createFoodLog("2026-08-31"), diet, meal);

    const twice = checkMeal(once, diet, meal);

    expect(twice).toBe(once);
    expect(twice.meals).toHaveLength(1);
  });

  it("leaves the diet itself untouched", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    checkMeal(createFoodLog("2026-08-31"), diet, meal);

    expect(diet.meals[0]?.sourceDietId).toBeUndefined();
  });
});

describe("isMealChecked", () => {
  it("is false for a day with nothing logged", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;

    expect(isMealChecked(createFoodLog("2026-08-31"), diet.id, meal.id)).toBe(
      false,
    );
  });

  it("is true once the meal is checked", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const log = checkMeal(createFoodLog("2026-08-31"), diet, meal);

    expect(isMealChecked(log, diet.id, meal.id)).toBe(true);
  });

  it("does not confuse a different meal id, even from the same diet", () => {
    const diet = dietWithBreakfast();
    const log = checkMeal(createFoodLog("2026-08-31"), diet, diet.meals[0]!);

    expect(isMealChecked(log, diet.id, "outra-refeicao")).toBe(false);
  });

  it("reports every meal as checked once the whole day was started from that diet", () => {
    // The bonus consistency `startDayFromDiet` was given: starting the whole
    // day is "I ate everything as planned".
    const diet = dietWithBreakfast();
    const log = startDayFromDiet(diet, "2026-08-31");

    expect(isMealChecked(log, diet.id, diet.meals[0]!.id)).toBe(true);
  });
});

describe("mealCheckState", () => {
  it("is 'unchecked' for a day with nothing logged", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;

    expect(mealCheckState(createFoodLog("2026-08-31"), diet.id, meal.id)).toBe(
      "unchecked",
    );
  });

  it("is 'checked' right after checking, untouched since", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const log = checkMeal(createFoodLog("2026-08-31"), diet, meal);

    expect(mealCheckState(log, diet.id, meal.id)).toBe("checked");
  });

  it("becomes 'edited' once a portion is changed in the Diário afterwards", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const log = checkMeal(createFoodLog("2026-08-31"), diet, meal);
    const loggedMeal = log.meals[0]!;
    const loggedItem = loggedMeal.items[0]!;

    const edited = setItemGrams(log, loggedMeal.id, loggedItem.id, 300);

    expect(mealCheckState(edited, diet.id, meal.id)).toBe("edited");
  });

  it("becomes 'edited' when a food is removed, not only when grams change", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const log = checkMeal(createFoodLog("2026-08-31"), diet, meal);
    const loggedMeal = log.meals[0]!;

    const edited = removeItem(log, loggedMeal.id, loggedMeal.items[0]!.id);

    expect(mealCheckState(edited, diet.id, meal.id)).toBe("edited");
  });

  it("stays 'checked' when an unrelated meal is edited", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    let log = checkMeal(createFoodLog("2026-08-31"), diet, meal);
    // A meal built by hand, alongside the checked one — its own edits must
    // not be mistaken for the checked meal's.
    log = {
      ...log,
      meals: [
        ...log.meals,
        { id: "m2", name: "Lanche", time: null, notes: "", items: [] },
      ],
    };

    const edited = removeItem(log, "m2", "algum-item");

    expect(mealCheckState(edited, diet.id, meal.id)).toBe("checked");
  });

  it("reports 'checked', not 'edited', right after starting the whole day", () => {
    const diet = dietWithBreakfast();
    const log = startDayFromDiet(diet, "2026-08-31");

    expect(mealCheckState(log, diet.id, diet.meals[0]!.id)).toBe("checked");
  });
});

describe("uncheckMeal", () => {
  it("removes the matching snapshot", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const checked = checkMeal(createFoodLog("2026-08-31"), diet, meal);

    const unchecked = uncheckMeal(checked, diet.id, meal.id);

    expect(unchecked.meals).toHaveLength(0);
  });

  it("is a no-op when nothing matches", () => {
    const log = createFoodLog("2026-08-31");

    expect(uncheckMeal(log, "algum-dieta", "alguma-refeicao")).toBe(log);
  });

  it("leaves a day built by hand alone", () => {
    // A meal added directly in the Diário has no `sourceMealId` — unchecking
    // an unrelated diet/meal pair must never touch it.
    const diet = dietWithBreakfast();
    const handMade = createFoodLog("2026-08-31");
    const withHandMadeMeal = {
      ...handMade,
      meals: [{ id: "m1", name: "Lanche", time: null, notes: "", items: [] }],
    };

    const result = uncheckMeal(withHandMadeMeal, diet.id, "qualquer-refeicao");

    expect(result).toBe(withHandMadeMeal);
  });
});

describe("toggleMealChecked", () => {
  it("checks an unchecked meal and unchecks a checked one", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;

    const checked = toggleMealChecked(createFoodLog("2026-08-31"), diet, meal);
    expect(isMealChecked(checked, diet.id, meal.id)).toBe(true);

    const unchecked = toggleMealChecked(checked, diet, meal);
    expect(isMealChecked(unchecked, diet.id, meal.id)).toBe(false);
    expect(unchecked.meals).toHaveLength(0);
  });
});
