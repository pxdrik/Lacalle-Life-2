import { describe, expect, it } from "vitest";

import type { Meal } from "../types/diet";
import type { FoodLog } from "../types/food-log";
import { createMeal, createMealItem } from "./create-diet";
import { createFoodLog } from "./start-day";
import { addItems, copiesOf, removeItems, sameMealYesterday } from "./yesterday-meal";

const PER_100G = { kcal: 100, proteinG: 10, carbsG: 10, fatG: 1 };

function meal(name: string, foods: readonly [string, number][], eaten?: boolean): Meal {
  return {
    ...createMeal(0),
    name,
    items: foods.map(([foodId, grams]) =>
      createMealItem({ foodId, name: foodId, grams, per100g: PER_100G }),
    ),
    ...(eaten === undefined ? {} : { eaten }),
  };
}

function day(date: string, meals: readonly Meal[]): FoodLog {
  return { ...createFoodLog(date), meals };
}

/** Roadmap 7.3 (30/09/2026): "Igual a ontem?". */
describe("sameMealYesterday", () => {
  const yesterday = day("2026-09-29", [
    meal("Café", [["aveia", 40]], true),
    meal("Almoço", [["arroz", 150], ["feijao", 100]], true),
    meal("Jantar", [["tilapia", 140]], false),
    meal("Lanche", [], true),
  ]);

  it("acha a refeição de mesmo nome, ignorando maiúsculas e espaços", () => {
    expect(sameMealYesterday(yesterday, " almoço ")?.name).toBe("Almoço");
  });

  it("não oferece refeição planejada que não foi comida", () => {
    expect(sameMealYesterday(yesterday, "Jantar")).toBeUndefined();
  });

  it("não oferece refeição que ontem estava vazia", () => {
    expect(sameMealYesterday(yesterday, "Lanche")).toBeUndefined();
  });

  it("sem dia de ontem, ou sem nome, nada", () => {
    expect(sameMealYesterday(undefined, "Almoço")).toBeUndefined();
    expect(sameMealYesterday(yesterday, "  ")).toBeUndefined();
  });

  it("refeição de antes do campo `eaten` existir conta como comida", () => {
    const legacy = day("2026-09-29", [meal("Almoço", [["arroz", 150]])]);
    expect(sameMealYesterday(legacy, "Almoço")?.items).toHaveLength(1);
  });
});

describe("copiar e desfazer", () => {
  it("copia com ids novos e as mesmas gramas, e o desfazer tira só o copiado", () => {
    const source = meal("Almoço", [["arroz", 150], ["feijao", 100]], true);
    const target = meal("Almoço", [], true);
    const today = day("2026-09-30", [target]);

    const copies = copiesOf(source.items);
    const copied = addItems(today, target.id, copies);
    const items = copied.meals[0]!.items;

    expect(items.map((item) => [item.foodId, item.grams])).toEqual([
      ["arroz", 150],
      ["feijao", 100],
    ]);
    expect(items.map((item) => item.id)).not.toEqual(source.items.map((item) => item.id));

    // Algo que a pessoa acrescentou depois de copiar fica.
    const extra = copiesOf([createMealItem({ foodId: "salada", name: "salada", grams: 80, per100g: PER_100G })]);
    const withExtra = addItems(copied, target.id, extra);
    const undone = removeItems(withExtra, target.id, copies.map((item) => item.id));

    expect(undone.meals[0]!.items.map((item) => item.foodId)).toEqual(["salada"]);
  });
});
