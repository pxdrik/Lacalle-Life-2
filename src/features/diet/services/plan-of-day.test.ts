import { describe, expect, it } from "vitest";

import type { Diet, Meal } from "../types/diet";
import type { PrescribedPlan } from "../types/prescribed-plan";
import { createDiet, createMeal, createMealItem } from "./create-diet";
import { adherenceByWeek } from "./diet-adherence";
import { assignWeekdays, dayChoice, dietOfDay } from "./diet-schedule";
import { checkMeal, mealCheckState, openMeal } from "./meal-execution";
import { chooseMealOption, currentOption, mealOptions } from "./plan-option";
import { createFoodLog } from "./start-day";

/**
 * O plano da nutricionista no dia a dia do paciente (Life Pro, Etapa 5c).
 *
 * A regra é do Pedro (01/10/2026, Etapa 5e): os dias são da nutricionista, e
 * num dia do plano ele é o padrão. Se o dia também for de uma dieta da
 * pessoa, ela escolhe, e a escolha fica no dia (`dietId`). O plano só vale a
 * partir do dia em que chegou, e sai do Diário quando o vínculo acaba. E a
 * "Opção de hoje" troca os alimentos do dia sem mudar o plano.
 */
const PER_100G = { kcal: 100, proteinG: 10, carbsG: 10, fatG: 2 };
const item = (name: string, grams = 100) => createMealItem({ foodId: name, name, grams, per100g: PER_100G });

// Segunda, 31/08/2026, 12:00; terça e quarta da mesma semana.
const MONDAY = new Date(2026, 7, 31, 12);
const TUESDAY = new Date(2026, 8, 1, 12);
const WEDNESDAY = new Date(2026, 8, 2, 12);

const lunch: Meal = {
  ...createMeal(1, "Almoço"),
  items: [item("Arroz"), item("Frango")],
  alternatives: [{ id: "marmita", name: "Marmita", items: [item("Macarrão", 150)] }],
};

function plan(overrides: Partial<PrescribedPlan> = {}): PrescribedPlan {
  return {
    id: "plano",
    name: "Recomposição",
    professionalName: "Marina Faria",
    version: 1,
    changeNote: "",
    publishedAt: "2026-08-01T12:00:00Z",
    meals: [lunch],
    previous: null,
    weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    linkEnded: false,
    seenVersion: 0,
    createdAt: new Date(2026, 7, 1).getTime(),
    updatedAt: 1,
    ...overrides,
  };
}

const ownOnTuesday: Diet = assignWeekdays([createDiet("Minha terça")], "x", [])[0]!;
const tuesdayDiet: Diet = { ...ownOnTuesday, weekdays: ["tue"] };

describe("o que vale em cada dia", () => {
  it("num dia do plano, o plano é o padrão, mesmo que o dia também seja de uma dieta da pessoa", () => {
    expect(dietOfDay([tuesdayDiet], [plan()], TUESDAY)?.id).toBe("plano");
    expect(dietOfDay([tuesdayDiet], [plan()], MONDAY)?.id).toBe("plano");
    expect(dayChoice([tuesdayDiet], [plan()], TUESDAY)).toMatchObject({ plan: { id: "plano" }, own: { id: tuesdayDiet.id } });
    expect(dayChoice([tuesdayDiet], [plan()], MONDAY), "segunda não tem o que escolher").toBeUndefined();
  });

  it("a escolha gravada no dia decide entre o plano e a dieta da pessoa", () => {
    expect(dietOfDay([tuesdayDiet], [plan()], TUESDAY, tuesdayDiet.id)?.id).toBe(tuesdayDiet.id);
    expect(dietOfDay([tuesdayDiet], [plan()], TUESDAY, "plano")?.id).toBe("plano");
    expect(dietOfDay([tuesdayDiet], [plan()], TUESDAY, "dieta-apagada")?.id, "escolha que não existe mais").toBe("plano");
  });

  it("fora dos dias do plano vale a dieta da pessoa", () => {
    expect(dietOfDay([tuesdayDiet], [plan({ weekdays: ["mon"] })], TUESDAY)?.id).toBe(tuesdayDiet.id);
  });

  it("vínculo encerrado: o plano sai do Diário, mas o dia feito por ele continua dele", () => {
    const ended = plan({ linkEnded: true });
    expect(dietOfDay([], [ended], MONDAY)).toBeUndefined();
    expect(dietOfDay([tuesdayDiet], [ended], TUESDAY)?.id).toBe(tuesdayDiet.id);
    expect(dayChoice([tuesdayDiet], [ended], TUESDAY)).toBeUndefined();
    expect(dietOfDay([], [ended], MONDAY, "plano")?.id).toBe("plano");
  });

  it("o plano só vale a partir do dia em que chegou", () => {
    const arrivedTuesday = plan({ createdAt: new Date(2026, 8, 1, 18).getTime() });
    expect(dietOfDay([], [arrivedTuesday], MONDAY)).toBeUndefined();
    expect(dietOfDay([], [arrivedTuesday], TUESDAY)?.id).toBe("plano");
  });

  it("dia que a nutricionista não escolheu fica sem plano", () => {
    expect(dietOfDay([], [plan({ weekdays: ["mon"] })], WEDNESDAY)).toBeUndefined();
  });

  it("a Evolução conta o plano nos dias dele e, no dia com escolha, o que a pessoa escolheu", () => {
    const planned = dietOfDay([], [plan()], MONDAY)!;
    const monday = checkMeal(createFoodLog("2026-08-31"), planned, planned.meals[0]!);
    const twoMeals: Diet = { ...tuesdayDiet, meals: [createMeal(1, "Café"), createMeal(2, "Jantar")] };
    const tuesday = { ...createFoodLog("2026-09-01"), dietId: twoMeals.id };
    const [week] = adherenceByWeek([twoMeals], [monday, tuesday], 1, WEDNESDAY.getTime(), [plan()]);
    // Segunda e quarta do plano (1 refeição cada); terça, a dieta que a pessoa escolheu (2 refeições).
    expect(week).toMatchObject({ daysWithPlan: 3, plannedMeals: 4, checkedMeals: 1 });
    // Sem escolha gravada, a terça é do plano.
    const [byDefault] = adherenceByWeek([twoMeals], [monday], 1, WEDNESDAY.getTime(), [plan()]);
    expect(byDefault).toMatchObject({ daysWithPlan: 3, plannedMeals: 3, checkedMeals: 1 });
  });
});

describe("opção de hoje", () => {
  const planned = dietOfDay([], [plan()], MONDAY)!;
  const opened = openMeal(createFoodLog("2026-08-31"), planned, lunch);
  const logged = opened.meals[0]!;
  const [, marmita] = mealOptions(lunch);

  it("abre na principal e troca para a opção escolhida, sem mexer no plano", () => {
    expect(currentOption(logged, mealOptions(lunch))?.id).toBe("principal");
    const chosen = chooseMealOption(opened, logged.id, marmita!);
    const meal = chosen.meals[0]!;
    expect(meal.items.map((food) => food.name)).toEqual(["Macarrão"]);
    expect(currentOption(meal, mealOptions(lunch))?.id).toBe("marmita");
    expect(meal.items[0]!.id, "o dia divide id com o plano").not.toBe(marmita!.items[0]!.id);
    expect(lunch.items.map((food) => food.name)).toEqual(["Arroz", "Frango"]);
  });

  it("marcar como comida depois de escolher conta como seguido, não como alterado", () => {
    const chosen = chooseMealOption(opened, logged.id, marmita!);
    const eaten = checkMeal(chosen, planned, lunch);
    expect(mealCheckState(eaten, planned.id, lunch.id)).toBe("checked");
  });
});
