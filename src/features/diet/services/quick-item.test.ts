import { describe, expect, it } from "vitest";

import { foodLogRecordSchema } from "@/composition/backup-schemas";

import type { Meal } from "../types/diet";
import { createMeal, createMealItem } from "./create-diet";
import { itemMacros, mealMacros } from "./diet-macros";
import {
  createQuickItem,
  editQuickItem,
  incompleteQuickCount,
  quickGaps,
  quickInputOf,
} from "./quick-item";
import { recentFoods } from "./recent-foods";
import { createFoodLog } from "./start-day";

/**
 * Registro rápido (roadmap 7.7, 30/09/2026). A decisão do Pedro: macro em
 * branco nunca vira zero; o total soma o que se sabe e avisa que falta.
 */

const RESTAURANT = { name: "Almoço no restaurante", kcal: 850, proteinG: 40, carbsG: null, fatG: null };

describe("o item avulso", () => {
  it("guarda as calorias e os macros como foram digitados, e o branco como branco", () => {
    const item = createQuickItem(RESTAURANT);

    expect(item.foodId).toBeNull();
    expect(itemMacros(item)).toEqual({ kcal: 850, proteinG: 40, carbsG: 0, fatG: 0 });
    expect(item.quick?.unknownMacros).toEqual(["carbsG", "fatG"]);
  });

  it("sem descrição se chama Avulso, e volta vazia para o formulário", () => {
    const item = createQuickItem({ ...RESTAURANT, name: "  " });

    expect(item.name).toBe("Avulso");
    expect(quickInputOf(item).name).toBe("");
  });

  it("editar mantém o id e devolve os campos em branco como null", () => {
    const item = createQuickItem(RESTAURANT);
    const edited = editQuickItem(item, { ...RESTAURANT, kcal: 900, carbsG: 95 });

    expect(edited.id).toBe(item.id);
    expect(quickInputOf(edited)).toEqual({ ...RESTAURANT, kcal: 900, carbsG: 95 });
  });
});

describe("o que falta no total", () => {
  const PER_100G = { kcal: 100, proteinG: 10, carbsG: 10, fatG: 1 };
  const meal = (items: Meal["items"]): Meal => ({ ...createMeal(1, "Almoço"), items });

  it("conta os avulsos com cada macro em branco, e zero quando está tudo informado", () => {
    const items = [
      createMealItem({ foodId: "arroz", name: "Arroz", grams: 150, per100g: PER_100G }),
      createQuickItem(RESTAURANT),
      createQuickItem({ ...RESTAURANT, proteinG: null, carbsG: 30, fatG: 10 }),
    ];

    expect(quickGaps(items)).toEqual({ proteinG: 1, carbsG: 1, fatG: 1 });
    expect(incompleteQuickCount(items)).toBe(2);
    expect(quickGaps([createQuickItem({ ...RESTAURANT, carbsG: 1, fatG: 1 })])).toEqual({
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });

  it("a refeição soma o que se sabe, sem inventar valor", () => {
    const total = mealMacros(
      meal([
        createMealItem({ foodId: "arroz", name: "Arroz", grams: 100, per100g: PER_100G }),
        createQuickItem(RESTAURANT),
      ]),
    );

    expect(total).toEqual({ kcal: 950, proteinG: 50, carbsG: 10, fatG: 1 });
  });
});

describe("fora do catálogo", () => {
  it("não aparece em Recentes", () => {
    const log = {
      ...createFoodLog("2026-09-29"),
      meals: [{ ...createMeal(1, "Almoço"), items: [createQuickItem(RESTAURANT)], eaten: true }],
    };

    expect(recentFoods([log], "2026-09-30", "2026-09-29")).toEqual([]);
  });
});

describe("backup e sincronização", () => {
  it("aceitam o avulso e recusam um macro que não existe", () => {
    const withQuick = {
      ...createFoodLog("2026-09-30"),
      meals: [{ ...createMeal(1, "Almoço"), items: [createQuickItem(RESTAURANT)] }],
    };
    expect(foodLogRecordSchema.safeParse(withQuick).success).toBe(true);

    const bogus = {
      ...withQuick,
      meals: [
        {
          ...withQuick.meals[0]!,
          items: [{ ...createQuickItem(RESTAURANT), quick: { unknownMacros: ["fibra"] } }],
        },
      ],
    };
    expect(foodLogRecordSchema.safeParse(bogus).success).toBe(false);
  });

  it("um dia sem avulso não ganha o campo, e continua no formato de antes", () => {
    const item = createMealItem({ foodId: "arroz", name: "Arroz", grams: 100, per100g: { kcal: 1, proteinG: 1, carbsG: 1, fatG: 1 } });
    expect("quick" in item).toBe(false);
  });
});
