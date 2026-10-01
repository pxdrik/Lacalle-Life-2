import { describe, expect, it } from "vitest";

import type { Meal } from "../types/diet";
import { createMeal, createMealItem } from "./create-diet";
import { comparePlans } from "./plan-changes";

/**
 * "O que mudou" na versão nova do plano: o paciente lê o que a comparação
 * consegue afirmar, refeição por refeição, e o total do dia antes e depois.
 */
const PER_100G = { kcal: 100, proteinG: 10, carbsG: 10, fatG: 2 };
const food = (name: string, grams: number) => createMealItem({ foodId: name, name, grams, per100g: PER_100G });

const lunch: Meal = { ...createMeal(1, "Almoço"), items: [food("Arroz", 150), food("Frango", 120)] };
const dinner: Meal = { ...createMeal(2, "Jantar"), items: [food("Tilápia", 140)], notes: "Pode trocar por frango." };

describe("o que mudou entre duas versões do plano", () => {
  it("nada mudou: nenhuma linha, mesmo total", () => {
    expect(comparePlans([lunch, dinner], [lunch, dinner])).toEqual({ changes: [], kcalBefore: 410, kcalAfter: 410 });
  });

  it("alimento trocado, quantidade mudada, orientação e refeição nova", () => {
    const snack: Meal = { ...createMeal(3, "Lanche"), items: [food("Iogurte", 170)] };
    const next: Meal[] = [
      { ...lunch, items: [food("Arroz", 150), food("Frango", 130)] },
      { ...dinner, items: [food("Frango", 130)], notes: "" },
      snack,
    ];
    const { changes, kcalBefore, kcalAfter } = comparePlans([lunch, dinner], next);
    expect(changes).toEqual([
      { kind: "item-grams", meal: "Almoço", item: "Frango", from: 120, to: 130, unit: "g" },
      { kind: "item-added", meal: "Jantar", item: "Frango", grams: 130, unit: "g" },
      { kind: "item-removed", meal: "Jantar", item: "Tilápia", grams: 140, unit: "g" },
      { kind: "notes", meal: "Jantar" },
      { kind: "meal-added", meal: "Lanche" },
    ]);
    expect([kcalBefore, kcalAfter]).toEqual([410, 580]);
  });

  it("refeição tirada e refeição renomeada se reconhecem pelo id, não pelo nome", () => {
    const { changes } = comparePlans([lunch, dinner], [{ ...lunch, name: "Almoço leve" }]);
    expect(changes).toEqual([
      { kind: "meal-renamed", from: "Almoço", to: "Almoço leve" },
      { kind: "meal-removed", meal: "Jantar" },
    ]);
  });
});
