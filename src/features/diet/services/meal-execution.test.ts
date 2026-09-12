import { describe, expect, it } from "vitest";

import { createDiet, createMealItem } from "./create-diet";
import { addItem, removeItem, setItemGrams } from "./edit-diet";
import {
  checkMeal,
  isMealEaten,
  isMealLogged,
  mealCheckState,
  toggleLoggedMeal,
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
      eaten: true,
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

  it("marks an already-logged, unchecked meal eaten in place — no new copy", () => {
    // The case `startDayFromDiet` created: the meal is already in the log,
    // seeded unchecked, and checking it must flip the flag on that same
    // entry rather than add a second one.
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const seeded = startDayFromDiet(diet, "2026-08-31");
    const seededId = seeded.meals[0]!.id;

    const checked = checkMeal(seeded, diet, meal);

    expect(checked.meals).toHaveLength(1);
    expect(checked.meals[0]?.id).toBe(seededId);
    expect(checked.meals[0]?.eaten).toBe(true);
  });

  it("leaves the diet itself untouched", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    checkMeal(createFoodLog("2026-08-31"), diet, meal);

    expect(diet.meals[0]?.sourceDietId).toBeUndefined();
  });
});

describe("isMealLogged", () => {
  it("is false for a day with nothing logged", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;

    expect(isMealLogged(createFoodLog("2026-08-31"), diet.id, meal.id)).toBe(
      false,
    );
  });

  it("is true once a copy exists, eaten or not", () => {
    const diet = dietWithBreakfast();
    const log = startDayFromDiet(diet, "2026-08-31");

    expect(isMealLogged(log, diet.id, diet.meals[0]!.id)).toBe(true);
    expect(isMealEaten(log, diet.id, diet.meals[0]!.id)).toBe(false);
  });
});

describe("isMealEaten", () => {
  it("is false for a day with nothing logged", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;

    expect(isMealEaten(createFoodLog("2026-08-31"), diet.id, meal.id)).toBe(
      false,
    );
  });

  it("is true once the meal is checked", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const log = checkMeal(createFoodLog("2026-08-31"), diet, meal);

    expect(isMealEaten(log, diet.id, meal.id)).toBe(true);
  });

  it("does not confuse a different meal id, even from the same diet", () => {
    const diet = dietWithBreakfast();
    const log = checkMeal(createFoodLog("2026-08-31"), diet, diet.meals[0]!);

    expect(isMealEaten(log, diet.id, "outra-refeicao")).toBe(false);
  });

  it("is false for every meal right after starting the whole day — a plan, not a record of already having eaten", () => {
    const diet = dietWithBreakfast();
    const log = startDayFromDiet(diet, "2026-08-31");

    expect(isMealEaten(log, diet.id, diet.meals[0]!.id)).toBe(false);
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

  it("is 'unchecked' for every meal right after starting the whole day", () => {
    const diet = dietWithBreakfast();
    const log = startDayFromDiet(diet, "2026-08-31");

    expect(mealCheckState(log, diet.id, diet.meals[0]!.id)).toBe("unchecked");
  });
});

describe("uncheckMeal", () => {
  it("keeps the meal in the log, just marks it not eaten", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;
    const checked = checkMeal(createFoodLog("2026-08-31"), diet, meal);
    const checkedId = checked.meals[0]!.id;

    const unchecked = uncheckMeal(checked, diet.id, meal.id);

    expect(unchecked.meals).toHaveLength(1);
    expect(unchecked.meals[0]?.id).toBe(checkedId);
    expect(unchecked.meals[0]?.eaten).toBe(false);
    expect(mealCheckState(unchecked, diet.id, meal.id)).toBe("unchecked");
  });

  it("is a no-op when nothing matches", () => {
    const log = createFoodLog("2026-08-31");

    expect(uncheckMeal(log, "algum-dieta", "alguma-refeicao")).toBe(log);
  });

  it("is a no-op when the meal is logged but already unchecked", () => {
    const diet = dietWithBreakfast();
    const log = startDayFromDiet(diet, "2026-08-31");

    expect(uncheckMeal(log, diet.id, diet.meals[0]!.id)).toBe(log);
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
  it("checks an unchecked meal and unchecks a checked one, keeping it logged either way", () => {
    const diet = dietWithBreakfast();
    const meal = diet.meals[0]!;

    const checked = toggleMealChecked(createFoodLog("2026-08-31"), diet, meal);
    expect(isMealEaten(checked, diet.id, meal.id)).toBe(true);

    const unchecked = toggleMealChecked(checked, diet, meal);
    expect(isMealEaten(unchecked, diet.id, meal.id)).toBe(false);
    expect(unchecked.meals).toHaveLength(1);
  });
});

describe("toggleLoggedMeal", () => {
  it("toggles a meal already in the log, by id pair alone", () => {
    const diet = dietWithBreakfast();
    const log = startDayFromDiet(diet, "2026-08-31");
    const mealId = diet.meals[0]!.id;

    const checked = toggleLoggedMeal(log, diet.id, mealId);
    expect(isMealEaten(checked, diet.id, mealId)).toBe(true);
    expect(checked.meals).toHaveLength(1);

    const unchecked = toggleLoggedMeal(checked, diet.id, mealId);
    expect(isMealEaten(unchecked, diet.id, mealId)).toBe(false);
    expect(unchecked.meals).toHaveLength(1);
  });

  it("is a no-op when the pair was never logged at all", () => {
    const log = createFoodLog("2026-08-31");

    expect(toggleLoggedMeal(log, "algum-dieta", "alguma-refeicao")).toBe(log);
  });
});
