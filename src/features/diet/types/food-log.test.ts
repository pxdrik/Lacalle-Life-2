import { describe, expect, it } from "vitest";

import { createFoodLog } from "../services/start-day";
import { isEmptyLog, type FoodLog } from "./food-log";

/**
 * The predicate that decides whether a day is stored or deleted.
 *
 * `useFoodLogDay` removes the record for any day this calls empty, so a wrong
 * answer here is not a wrong answer on a screen — it is the user's work not
 * being written. That is what happened: a meal created in the diary, named and
 * annotated, was thrown away on the way to storage because it had no food in
 * it yet.
 */

const mealNamed = (name: string) => ({
  id: `m-${name}`,
  name,
  time: null,
  notes: "",
  items: [],
});

function logWith(meals: FoodLog["meals"]): FoodLog {
  return { ...createFoodLog("2026-08-14"), meals };
}

describe("isEmptyLog", () => {
  it("is true for a day nobody has touched", () => {
    // Still the case that must delete: an untouched Tuesday is not a Tuesday
    // you logged, and storing it would put a zero where the truth is silence.
    expect(isEmptyLog(createFoodLog("2026-08-14"))).toBe(true);
  });

  it("is false for a day holding a meal that has no food yet", () => {
    // The regression. Declaring "Almoço" is a record of intent, and the app
    // asked for it — the button is called "Adicionar refeição".
    expect(isEmptyLog(logWith([mealNamed("Almoço")]))).toBe(false);
  });

  it("is false for a day started from a diet whose meals are still empty", () => {
    // The second way in: `startDayFromDiet` copies five named meals, and a
    // plan without portions filled in used to vanish on reload.
    expect(
      isEmptyLog(
        logWith([
          mealNamed("Café da manhã"),
          mealNamed("Almoço"),
          mealNamed("Jantar"),
        ]),
      ),
    ).toBe(false);
  });

  it("is false once there is food, which never regressed", () => {
    expect(
      isEmptyLog(
        logWith([
          {
            ...mealNamed("Almoço"),
            items: [
              {
                id: "i1",
                foodId: "frango",
                name: "Peito de frango",
                grams: 200,
                unit: "g",
                per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
              },
            ],
          },
        ]),
      ),
    ).toBe(false);
  });
});
