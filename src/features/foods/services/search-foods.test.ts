import { describe, expect, it } from "vitest";

import type { Food } from "../types/food";
import { searchFoods, type FoodQuery } from "./search-foods";

function food(
  name: string,
  category: Food["category"] = "protein",
  isFavorite = false,
): Food {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    category,
    per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
    isCustom: false,
    isFavorite,
    createdAt: 1,
    updatedAt: 1,
  };
}

/** Defaults to "no filters", so each test states only what it is exercising. */
function query(overrides: Partial<FoodQuery> = {}): FoodQuery {
  return { text: "", category: null, favoritesOnly: false, ...overrides };
}

const CATALOGUE: readonly Food[] = [
  food("Abacate", "fruit"),
  food("Açúcar refinado", "carb"),
  food("Arroz branco cozido", "carb", true),
  food("Frango desfiado", "protein", true),
  food("Peito de frango grelhado"),
  food("Salada com frango"),
];

const names = (foods: readonly Food[]) => foods.map((f) => f.name);

describe("searchFoods", () => {
  it("returns everything for an empty query", () => {
    expect(searchFoods(CATALOGUE, query())).toHaveLength(6);
  });

  it("ignores surrounding whitespace", () => {
    expect(searchFoods(CATALOGUE, query({ text: "   " }))).toHaveLength(6);
  });

  describe("accents", () => {
    it("finds an accented name from unaccented input", () => {
      // Someone typing quickly on a phone will not reach for the ç or the ú.
      const found = searchFoods(CATALOGUE, query({ text: "acucar" }));

      expect(names(found)).toEqual(["Açúcar refinado"]);
    });

    it("finds it from accented input too", () => {
      const found = searchFoods(CATALOGUE, query({ text: "açúcar" }));

      expect(names(found)).toEqual(["Açúcar refinado"]);
    });
  });

  describe("ranking", () => {
    it("puts names that start with the term first", () => {
      const found = searchFoods(CATALOGUE, query({ text: "frango" }));

      expect(names(found)[0]).toBe("Frango desfiado");
      expect(found).toHaveLength(3);
    });

    it("ranks a word-start match above a mid-word one", () => {
      const foods = [food("Abacaxi"), food("Caxi"), food("Suco de caxi")];
      const found = searchFoods(foods, query({ text: "caxi" }));

      expect(names(found)).toEqual(["Caxi", "Suco de caxi", "Abacaxi"]);
    });
  });

  describe("multiple terms", () => {
    it("matches terms in any order", () => {
      const found = searchFoods(CATALOGUE, query({ text: "frango peito" }));

      expect(names(found)).toEqual(["Peito de frango grelhado"]);
    });

    it("requires every term to appear", () => {
      const found = searchFoods(CATALOGUE, query({ text: "frango jacaré" }));

      expect(found).toEqual([]);
    });
  });

  describe("category", () => {
    it("narrows to one category", () => {
      const found = searchFoods(CATALOGUE, query({ category: "carb" }));

      expect(names(found)).toEqual(["Açúcar refinado", "Arroz branco cozido"]);
    });

    it("combines with the text query", () => {
      const found = searchFoods(
        CATALOGUE,
        query({ text: "a", category: "fruit" }),
      );

      expect(names(found)).toEqual(["Abacate"]);
    });

    it("returns nothing when the category has no match for the text", () => {
      const found = searchFoods(
        CATALOGUE,
        query({ text: "frango", category: "carb" }),
      );

      expect(found).toEqual([]);
    });
  });

  describe("favourites", () => {
    it("narrows to favourites", () => {
      const found = searchFoods(CATALOGUE, query({ favoritesOnly: true }));

      expect(names(found)).toEqual(["Arroz branco cozido", "Frango desfiado"]);
    });

    it("combines with the text query", () => {
      const found = searchFoods(
        CATALOGUE,
        query({ text: "frango", favoritesOnly: true }),
      );

      expect(names(found)).toEqual(["Frango desfiado"]);
    });

    it("combines with the category", () => {
      const found = searchFoods(
        CATALOGUE,
        query({ category: "carb", favoritesOnly: true }),
      );

      expect(names(found)).toEqual(["Arroz branco cozido"]);
    });

    it("returns nothing when no favourite matches", () => {
      const found = searchFoods(
        CATALOGUE,
        query({ category: "fruit", favoritesOnly: true }),
      );

      expect(found).toEqual([]);
    });
  });

  it("does not mutate the input", () => {
    const original = [...CATALOGUE];
    searchFoods(CATALOGUE, query({ text: "frango" }));

    expect(CATALOGUE).toEqual(original);
  });
});
