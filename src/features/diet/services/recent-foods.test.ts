import { describe, expect, it } from "vitest";

import type { FoodLog } from "../types/food-log";
import type { Meal } from "../types/diet";
import { createMeal, createMealItem } from "./create-diet";
import { RECENT_FOODS_LIMIT, recentFoods } from "./recent-foods";
import { createFoodLog } from "./start-day";

const PER_100G = { kcal: 100, proteinG: 10, carbsG: 10, fatG: 1 };
const TODAY = "2026-09-30";
const YESTERDAY = "2026-09-29";

function meal(
  name: string,
  items: readonly [string | null, number][],
  eaten?: boolean,
): Meal {
  return {
    ...createMeal(0),
    name,
    items: items.map(([foodId, grams]) =>
      createMealItem({ foodId, name: foodId ?? "Avulso", grams, per100g: PER_100G }),
    ),
    ...(eaten === undefined ? {} : { eaten }),
  };
}

function day(date: string, meals: readonly Meal[]): FoodLog {
  return { ...createFoodLog(date), meals };
}

/** Roadmap 7.2 (30/09/2026): "Recentes" no seletor de alimentos. */
describe("recentFoods", () => {
  it("do mais recente para o mais antigo, com a quantidade da última vez", () => {
    const logs = [
      day("2026-09-28", [meal("Almoço", [["arroz", 150]], true)]),
      day(TODAY, [meal("Café", [["aveia", 40]], true)]),
      day(YESTERDAY, [meal("Almoço", [["arroz", 200], ["feijao", 100]], true)]),
    ];

    expect(recentFoods(logs, TODAY, YESTERDAY)).toEqual([
      { foodId: "aveia", grams: 40, detail: "Hoje · Café · 40 g" },
      { foodId: "feijao", grams: 100, detail: "Ontem · Almoço · 100 g" },
      { foodId: "arroz", grams: 200, detail: "Ontem · Almoço · 200 g" },
    ]);
  });

  it("dentro do dia, a última refeição e o último item vêm primeiro", () => {
    const logs = [
      day(TODAY, [
        meal("Café", [["aveia", 40], ["banana", 100]], true),
        meal("Almoço", [["frango", 130]], true),
      ]),
    ];

    expect(recentFoods(logs, TODAY, YESTERDAY).map((r) => r.foodId)).toEqual([
      "frango",
      "banana",
      "aveia",
    ]);
  });

  it("só conta refeição comida, nunca a planejada ainda não marcada", () => {
    const logs = [
      day(TODAY, [meal("Jantar", [["tilapia", 140]], false), meal("Almoço", [["arroz", 150]], true)]),
    ];

    expect(recentFoods(logs, TODAY, YESTERDAY).map((r) => r.foodId)).toEqual(["arroz"]);
  });

  it("refeição de antes do campo `eaten` existir conta como comida", () => {
    // Dado legado: a chave não existe (`undefined`), e antes do campo estar no
    // diário já era ter comido. Ver `isMealEaten`.
    const logs = [day(YESTERDAY, [meal("Almoço", [["arroz", 150]])])];

    expect(recentFoods(logs, TODAY, YESTERDAY).map((r) => r.foodId)).toEqual(["arroz"]);
  });

  it("deixa de fora item sem alimento do catálogo", () => {
    const logs = [day(TODAY, [meal("Almoço", [[null, 300], ["arroz", 150]], true)])];

    expect(recentFoods(logs, TODAY, YESTERDAY).map((r) => r.foodId)).toEqual(["arroz"]);
  });

  it("ignora dias no futuro", () => {
    const logs = [
      day("2026-10-01", [meal("Almoço", [["frango", 130]], true)]),
      day(TODAY, [meal("Café", [["aveia", 40]], true)]),
    ];

    expect(recentFoods(logs, TODAY, YESTERDAY).map((r) => r.foodId)).toEqual(["aveia"]);
  });

  it("dias antes de ontem mostram a data, e refeição sem nome vira Refeição", () => {
    const logs = [day("2026-09-22", [meal("", [["arroz", 150]], true)])];

    expect(recentFoods(logs, TODAY, YESTERDAY)[0]?.detail).toBe("22/09 · Refeição · 150 g");
  });

  it(`para em ${String(RECENT_FOODS_LIMIT)}`, () => {
    const foods = Array.from({ length: 10 }, (_, i) => [`f${String(i)}`, 50] as [string, number]);
    const logs = [day(TODAY, [meal("Almoço", foods, true)])];

    expect(recentFoods(logs, TODAY, YESTERDAY)).toHaveLength(RECENT_FOODS_LIMIT);
  });

  it("sem registro, nenhum recente", () => {
    expect(recentFoods([], TODAY, YESTERDAY)).toEqual([]);
  });
});
