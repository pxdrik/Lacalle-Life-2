import { describe, expect, it } from "vitest";

import { checkMeal } from "./meal-execution";
import { createDiet, createMealItem } from "./create-diet";
import { addItem, addMeal } from "./edit-diet";
import { createFoodLog } from "./start-day";
import { adherenceByWeek } from "./diet-adherence";
import type { Diet } from "../types/diet";
import type { FoodLog } from "../types/food-log";
import { assignWeekdays } from "./diet-schedule";

const PER_100G = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };

// A fixed instant: Monday 2026-08-31, 12:00 local — inside week-of-2026-08-31.
const MONDAY = new Date(2026, 7, 31, 12, 0, 0).getTime();
// Tuesday the same week — `now` for tests that need to look back at both.
const TUESDAY = new Date(2026, 8, 1, 12, 0, 0).getTime();

function dietWithTwoMeals(weekdays: readonly ("mon" | "tue")[]): Diet {
  let diet = createDiet("Cutting");
  diet = addItem(
    diet,
    diet.meals[0]!.id,
    createMealItem({ foodId: "ovo", name: "Ovo", grams: 100, per100g: PER_100G }),
  );
  diet = addMeal(diet);
  diet = addItem(
    diet,
    diet.meals[1]!.id,
    createMealItem({ foodId: "frango", name: "Frango", grams: 100, per100g: PER_100G }),
  );
  return assignWeekdays([diet], diet.id, weekdays)[0]!;
}

describe("adherenceByWeek", () => {
  it("counts nothing for a week with no diet scheduled at all", () => {
    const [point] = adherenceByWeek([], [], 1, MONDAY);

    expect(point).toMatchObject({
      checkedMeals: 0,
      plannedMeals: 0,
      daysWithPlan: 0,
    });
  });

  it("counts a planned meal even when nothing was checked", () => {
    // Adherence exists to show exactly this — a plan with nothing done.
    const diet = dietWithTwoMeals(["mon"]);
    const [point] = adherenceByWeek([diet], [], 1, MONDAY);

    expect(point).toMatchObject({ checkedMeals: 0, plannedMeals: 2, daysWithPlan: 1 });
  });

  it("counts a checked meal against the plan", () => {
    const diet = dietWithTwoMeals(["mon"]);
    const log = checkMeal(createFoodLog("2026-08-31"), diet, diet.meals[0]!);
    const [point] = adherenceByWeek([diet], [log], 1, MONDAY);

    expect(point).toMatchObject({ checkedMeals: 1, plannedMeals: 2, daysWithPlan: 1 });
  });

  it("does not count a checked meal from a different diet", () => {
    const diet = dietWithTwoMeals(["mon"]);
    const otherDiet = createDiet("Bulking");
    const log = checkMeal(
      createFoodLog("2026-08-31"),
      otherDiet,
      otherDiet.meals[0]!,
    );
    const [point] = adherenceByWeek([diet], [log], 1, MONDAY);

    expect(point).toMatchObject({ checkedMeals: 0, plannedMeals: 2 });
  });

  it("sums across every day the week had a diet scheduled", () => {
    const diet = dietWithTwoMeals(["mon", "tue"]);
    const monday = checkMeal(createFoodLog("2026-08-31"), diet, diet.meals[0]!);
    const tuesday = checkMeal(createFoodLog("2026-09-01"), diet, diet.meals[0]!);

    const [point] = adherenceByWeek([diet], [monday, tuesday], 1, TUESDAY);

    expect(point).toMatchObject({
      checkedMeals: 2,
      plannedMeals: 4,
      daysWithPlan: 2,
    });
  });

  it("seeds every week in the window, even ones with nothing planned", () => {
    const points = adherenceByWeek([], [], 4, MONDAY);

    expect(points).toHaveLength(4);
    for (const point of points) {
      expect(point).toMatchObject({ plannedMeals: 0, daysWithPlan: 0 });
    }
  });

  it("orders points most recent week first", () => {
    const points = adherenceByWeek([], [], 3, MONDAY);

    for (let i = 1; i < points.length; i += 1) {
      expect(points[i - 1]!.startsAt).toBeGreaterThan(points[i]!.startsAt);
    }
  });

  it("caps checked meals at the diet's own meal count, never overcounting", () => {
    // Belt and suspenders: `checkMeal` already prevents a duplicate, but the
    // cap keeps the fraction honest even against corrupted data.
    const diet = dietWithTwoMeals(["mon"]);
    let log: FoodLog = createFoodLog("2026-08-31");
    log = checkMeal(log, diet, diet.meals[0]!);
    log = checkMeal(log, diet, diet.meals[1]!);
    // A third, hand-crafted entry claiming the same diet — not reachable
    // through the app's own UI, but not impossible in stored data either.
    log = { ...log, meals: [...log.meals, { ...log.meals[0]!, id: "extra" }] };

    const [point] = adherenceByWeek([diet], [log], 1, MONDAY);

    expect(point?.checkedMeals).toBe(2);
  });
});
