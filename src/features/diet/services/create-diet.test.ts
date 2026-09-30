import { describe, expect, it } from "vitest";

import { createMealItem, createDiet, nextMealName, normalizeMealName } from "./create-diet";
import { addMeal } from "./edit-diet";

/**
 * `practicalUnit` follows the exact same copy-not-lookup rule `per100g`
 * already follows — see the doc comment on `MealItem`. This only tests that
 * the copy actually happens (and does not happen when there is nothing to
 * copy); the rule itself is documented on the type.
 */
describe("createMealItem", () => {
  const PER_100G = { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 };

  it("copies the food's practical unit onto the item", () => {
    const item = createMealItem({
      foodId: "abacate",
      name: "Abacate",
      grams: 100,
      per100g: PER_100G,
      practicalUnit: { label: "1/2 unidade média", grams: 100 },
    });

    expect(item.practicalUnit).toEqual({
      label: "1/2 unidade média",
      grams: 100,
    });
  });

  it("leaves practicalUnit undefined when the food has none", () => {
    const item = createMealItem({
      foodId: "salmao",
      name: "Salmão",
      grams: 100,
      per100g: PER_100G,
    });

    expect(item.practicalUnit).toBeUndefined();
  });

  it("copies brand and the four optional nutrients (RM02) the same way", () => {
    const item = createMealItem({
      foodId: "iogurte-marca",
      name: "Iogurte",
      grams: 100,
      per100g: PER_100G,
      brand: "Marca X",
      saturatedFatG: 1.5,
      sodiumMg: 45,
      fiberG: 0,
      sugarG: 12,
    });

    expect(item).toMatchObject({
      brand: "Marca X",
      saturatedFatG: 1.5,
      sodiumMg: 45,
      fiberG: 0,
      sugarG: 12,
    });
  });

  it("leaves the four optional nutrients undefined, not zero, when the food has none on file", () => {
    const item = createMealItem({
      foodId: "salmao",
      name: "Salmão",
      grams: 100,
      per100g: PER_100G,
    });

    expect(item.brand).toBeUndefined();
    expect(item.saturatedFatG).toBeUndefined();
    expect(item.sodiumMg).toBeUndefined();
    expect(item.fiberG).toBeUndefined();
    expect(item.sugarG).toBeUndefined();
  });
});

/**
 * Pedro, 30/09/2026 (roadmap 7.3): refeição nova nasce com o nome do dia a dia,
 * na ordem, para "Igual a ontem?" achar a mesma refeição escrita igual.
 */
describe("nomes de refeição", () => {
  it("uma dieta nova começa com Café da manhã", () => {
    expect(createDiet("Cutting").meals.map((meal) => meal.name)).toEqual(["Café da manhã"]);
  });

  it("adicionar segue a ordem: Almoço, Lanche da tarde, Jantar, e depois Refeição N", () => {
    let diet = createDiet("Cutting");
    for (let i = 0; i < 4; i += 1) diet = addMeal(diet);

    expect(diet.meals.map((meal) => meal.name)).toEqual([
      "Café da manhã",
      "Almoço",
      "Lanche da tarde",
      "Jantar",
      "Refeição 5",
    ]);
  });

  it("nunca repete: pula o que já existe, mesmo escrito sem acento", () => {
    expect(nextMealName([{ name: "cafe da manha" }], 2)).toBe("Almoço");
    expect(nextMealName([{ name: "Pré-treino" }], 2)).toBe("Café da manhã");
  });

  it("compara sem acento, sem maiúsculas e sem espaço sobrando", () => {
    expect(normalizeMealName("  Café  da Manhã ")).toBe(normalizeMealName("cafe da manha"));
    expect(normalizeMealName("Almoço")).not.toBe(normalizeMealName("Jantar"));
  });
});
