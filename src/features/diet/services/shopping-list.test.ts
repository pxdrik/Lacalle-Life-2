import { describe, expect, it } from "vitest";

import type { FoodCategory } from "@/features/foods";

import type { Diet, MealItem, Weekday } from "../types/diet";
import { createDiet, createMealItem } from "./create-diet";
import { addItem, addMeal } from "./edit-diet";
import {
  buildShoppingList,
  formatAmount,
  shoppingListText,
} from "./shopping-list";

const WEEK: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const MACROS = { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1 };

const CATEGORIES: Record<string, FoodCategory> = {
  rice: "carb",
  beans: "carb",
  chicken: "protein",
  milk: "dairy",
};
const categoryOf = (id: string) => CATEGORIES[id];

const item = (
  foodId: string | null,
  name: string,
  grams: number,
  unit?: "g" | "ml",
): MealItem => createMealItem({ foodId, name, grams, unit, per100g: MACROS });

/** Uma dieta com os itens todos na primeira refeição, marcada para os dias dados. */
function diet(name: string, days: readonly Weekday[], ...items: MealItem[]): Diet {
  let built = createDiet(name);
  for (const each of items) built = addItem(built, built.meals[0]!.id, each);
  return { ...built, weekdays: days };
}

const amounts = (list: ReturnType<typeof buildShoppingList>) =>
  list.groups.flatMap((g) => g.items.map((i) => [i.name, i.amount, i.unit]));

describe("buildShoppingList", () => {
  it("multiplies a diet by the days it is scheduled", () => {
    const list = buildShoppingList(
      [diet("A", ["mon", "wed", "fri"], item("rice", "Arroz cozido", 300))],
      categoryOf,
    );

    expect(amounts(list)).toEqual([["Arroz cozido", 900, "g"]]);
  });

  it("adds the same food across meals of one diet", () => {
    let built = diet("A", ["mon", "tue"], item("rice", "Arroz cozido", 100));
    built = addMeal(built);
    built = addItem(built, built.meals[1]!.id, item("rice", "Arroz cozido", 150));

    expect(amounts(buildShoppingList([built], categoryOf))).toEqual([
      ["Arroz cozido", 500, "g"],
    ]);
  });

  it("adds the same food across diets, each with its own days", () => {
    const list = buildShoppingList(
      [
        diet("Semana", ["mon", "tue", "wed", "thu", "fri"], item("rice", "Arroz", 100)),
        diet("Fim de semana", ["sat", "sun"], item("rice", "Arroz", 200)),
      ],
      categoryOf,
    );

    expect(amounts(list)).toEqual([["Arroz", 900, "g"]]);
  });

  it("leaves out a diet with no day marked", () => {
    const list = buildShoppingList(
      [
        diet("Solta", [], item("rice", "Arroz", 100)),
        diet("Marcada", ["mon"], item("chicken", "Frango", 200)),
      ],
      categoryOf,
    );

    expect(amounts(list)).toEqual([["Frango", 200, "g"]]);
    expect(list.sources).toEqual([{ name: "Marcada", days: "Seg" }]);
  });

  it("does not count a meal's saved alternatives, only what is built today", () => {
    const base = diet("A", ["mon"], item("rice", "Arroz", 100));
    const withAlternative: Diet = {
      ...base,
      meals: base.meals.map((meal) => ({
        ...meal,
        alternatives: [
          { id: "alt", name: "Com macarrão", items: [item(null, "Macarrão", 500)] },
        ],
      })),
    };

    expect(amounts(buildShoppingList([withAlternative], categoryOf))).toEqual([
      ["Arroz", 100, "g"],
    ]);
  });

  it("merges by food, even when the name was copied differently", () => {
    const list = buildShoppingList(
      [
        diet(
          "A",
          ["mon"],
          item("rice", "Arroz branco cozido", 100),
          item("rice", "Arroz", 50),
        ),
      ],
      categoryOf,
    );

    expect(amounts(list)).toEqual([["Arroz branco cozido", 150, "g"]]);
  });

  it("merges a food with no catalogue id by name, and keeps ml apart from g", () => {
    const list = buildShoppingList(
      [
        diet(
          "A",
          ["mon"],
          item(null, "Panqueca da casa", 80),
          item(null, "panqueca da casa ", 20),
          item(null, "Panqueca da casa", 30, "ml"),
        ),
      ],
      categoryOf,
    );

    expect(amounts(list)).toEqual([
      ["Panqueca da casa", 100, "g"],
      ["Panqueca da casa", 30, "ml"],
    ]);
  });

  it("reads an item saved before liquids existed (no unit at all) as grams", () => {
    // Do jeito que a versão antiga gravava: sem a chave `unit`, não `unit: undefined`.
    const legacy: Record<string, unknown> = { ...item("rice", "Arroz", 100) };
    delete legacy.unit;

    const list = buildShoppingList(
      [diet("A", ["mon"], legacy as unknown as MealItem)],
      categoryOf,
    );

    expect(amounts(list)).toEqual([["Arroz", 100, "g"]]);
  });

  it("rounds a fraction up, so there is never less than the diet asks", () => {
    // 37,5 g em 7 dias = 262,5 g
    const list = buildShoppingList([diet("A", WEEK, item("rice", "Arroz", 37.5))], categoryOf);

    expect(amounts(list)).toEqual([["Arroz", 263, "g"]]);
  });

  it("does not round up because of floating point noise", () => {
    // 1,1 x 7 + 1,1 x 3 dá 11,000000000000002 em ponto flutuante; são 11 g.
    const list = buildShoppingList(
      [
        diet("A", WEEK, item("rice", "Arroz", 1.1)),
        diet("B", ["mon", "tue", "wed"], item("rice", "Arroz", 1.1)),
      ],
      categoryOf,
    );

    expect(amounts(list)).toEqual([["Arroz", 11, "g"]]);
  });

  it("groups by category, sorts by name, and puts what has no category last", () => {
    const list = buildShoppingList(
      [
        diet(
          "A",
          ["mon"],
          item("milk", "Leite", 200, "ml"),
          item("beans", "Feijão", 100),
          item("rice", "Arroz", 100),
          item("chicken", "Frango", 100),
          item(null, "Açaí da casa", 100),
          item("apagado", "Alimento removido", 100),
        ),
      ],
      categoryOf,
    );

    expect(list.groups.map((g) => [g.title, g.items.map((i) => i.name)])).toEqual([
      ["Proteínas", ["Frango"]],
      ["Carboidratos", ["Arroz", "Feijão"]],
      ["Laticínios", ["Leite"]],
      ["Outros", ["Açaí da casa", "Alimento removido"]],
    ]);
  });

  it("skips an item with nothing in it", () => {
    const list = buildShoppingList(
      [diet("A", ["mon"], item("rice", "Arroz", 0))],
      categoryOf,
    );

    expect(list.groups).toEqual([]);
  });
});

describe("formatAmount", () => {
  it("writes grams and millilitres up to 999, and goes up a unit from 1000", () => {
    expect(formatAmount(800, "g")).toBe("800 g");
    expect(formatAmount(1400, "g")).toBe("1,4 kg");
    expect(formatAmount(2973, "g")).toBe("2,973 kg");
    expect(formatAmount(300, "ml")).toBe("300 ml");
    expect(formatAmount(1500, "ml")).toBe("1,5 L");
  });
});

describe("shoppingListText", () => {
  it("is plain text, one line per food, ready to paste", () => {
    const text = shoppingListText(
      buildShoppingList(
        [
          diet(
            "Treino",
            ["mon", "wed"],
            item("chicken", "Frango grelhado", 700),
            item("rice", "Arroz cozido", 300),
          ),
        ],
        categoryOf,
      ),
    );

    expect(text).toBe(
      [
        "Lista de compras da semana",
        "",
        "Dietas: Treino (Seg, Qua)",
        "",
        "Proteínas",
        "- Frango grelhado: 1,4 kg",
        "",
        "Carboidratos",
        "- Arroz cozido: 600 g",
      ].join("\n"),
    );
  });
});
