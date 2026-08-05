import { describe, expect, it } from "vitest";

import type { Food } from "../types/food";
import { searchFoods } from "./search-foods";

function food(name: string, category: Food["category"] = "protein"): Food {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    category,
    per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
    isCustom: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

const CATALOGUE: readonly Food[] = [
  food("Abacate", "fruit"),
  food("Açúcar refinado", "carb"),
  food("Arroz branco cozido", "carb"),
  food("Frango desfiado"),
  food("Peito de frango grelhado"),
  food("Salada com frango"),
];

const names = (foods: readonly Food[]) => foods.map((f) => f.name);

describe("searchFoods", () => {
  it("returns everything for an empty query", () => {
    expect(searchFoods(CATALOGUE, { text: "", category: null })).toHaveLength(6);
  });

  it("ignores surrounding whitespace", () => {
    expect(searchFoods(CATALOGUE, { text: "   ", category: null })).toHaveLength(6);
  });

  describe("accents", () => {
    it("finds an accented name from unaccented input", () => {
      // Someone typing quickly on a phone will not reach for the ç or the ú.
      const found = searchFoods(CATALOGUE, { text: "acucar", category: null });

      expect(names(found)).toEqual(["Açúcar refinado"]);
    });

    it("finds it from accented input too", () => {
      const found = searchFoods(CATALOGUE, { text: "açúcar", category: null });

      expect(names(found)).toEqual(["Açúcar refinado"]);
    });
  });

  describe("ranking", () => {
    it("puts names that start with the term first", () => {
      const found = searchFoods(CATALOGUE, { text: "frango", category: null });

      expect(names(found)[0]).toBe("Frango desfiado");
      expect(names(found)).toHaveLength(3);
    });

    it("ranks a word-start match above a mid-word one", () => {
      const foods = [food("Abacaxi"), food("Caxi"), food("Suco de caxi")];
      const found = searchFoods(foods, { text: "caxi", category: null });

      expect(names(found)).toEqual(["Caxi", "Suco de caxi", "Abacaxi"]);
    });

    it("keeps alphabetical order among equally ranked results", () => {
      const found = searchFoods(CATALOGUE, { text: "o", category: null });
      const equallyRanked = names(found).filter((n) => n.startsWith("O"));

      expect(equallyRanked).toEqual([...equallyRanked].sort());
    });
  });

  describe("multiple terms", () => {
    it("matches terms in any order", () => {
      const found = searchFoods(CATALOGUE, {
        text: "frango peito",
        category: null,
      });

      expect(names(found)).toEqual(["Peito de frango grelhado"]);
    });

    it("requires every term to appear", () => {
      const found = searchFoods(CATALOGUE, {
        text: "frango jacaré",
        category: null,
      });

      expect(found).toEqual([]);
    });
  });

  describe("category", () => {
    it("narrows to one category", () => {
      const found = searchFoods(CATALOGUE, { text: "", category: "carb" });

      expect(names(found)).toEqual(["Açúcar refinado", "Arroz branco cozido"]);
    });

    it("combines with the text query", () => {
      const found = searchFoods(CATALOGUE, { text: "a", category: "fruit" });

      expect(names(found)).toEqual(["Abacate"]);
    });

    it("returns nothing when the category has no match for the text", () => {
      const found = searchFoods(CATALOGUE, { text: "frango", category: "carb" });

      expect(found).toEqual([]);
    });
  });

  it("does not mutate the input", () => {
    const original = [...CATALOGUE];
    searchFoods(CATALOGUE, { text: "frango", category: null });

    expect(CATALOGUE).toEqual(original);
  });
});
