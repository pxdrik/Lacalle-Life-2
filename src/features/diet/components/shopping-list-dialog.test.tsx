import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";
import type { Food } from "@/features/foods";

import { createDiet, createMealItem } from "../services/create-diet";
import { addItem } from "../services/edit-diet";
import type { Diet, Weekday } from "../types/diet";
import { ShoppingListButton } from "./shopping-list-dialog";

const CHICKEN: Food = {
  id: "peito-de-frango-grelhado",
  name: "Peito de frango grelhado",
  category: "protein",
  unit: "g",
  per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  isCustom: false,
  isFavorite: false,
  createdAt: 1,
  updatedAt: 1,
};

function dietWith(days: readonly Weekday[]): Diet {
  const base = createDiet("Treino");
  const item = createMealItem({
    foodId: CHICKEN.id,
    name: CHICKEN.name,
    grams: 700,
    per100g: CHICKEN.per100g,
  });
  return { ...addItem(base, base.meals[0]!.id, item), weekdays: days };
}

async function mount(diets: readonly Diet[]) {
  const foods = new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));
  await foods.save(CHICKEN, null);

  render(
    <FoodRepositoryProvider repository={Promise.resolve(foods)}>
      <ShoppingListButton diets={diets} />
    </FoodRepositoryProvider>,
  );

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lista de compras" }));
  return user;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ShoppingListButton", () => {
  it("lists what the scheduled diets ask for, grouped by the food's category", async () => {
    await mount([dietWith(["mon", "wed"])]);

    const heading = await screen.findByRole("heading", { name: "Proteínas" });
    const section = heading.closest("section")!;
    expect(within(section).getByText("Peito de frango grelhado")).toBeInTheDocument();
    // 700 g x 2 dias
    expect(within(section).getByText("1,4 kg")).toBeInTheDocument();
    expect(screen.getByText(/Dietas: Treino \(Seg, Qua\)/)).toBeInTheDocument();
  });

  it("says what is missing when no diet has a day marked", async () => {
    await mount([dietWith([])]);

    expect(await screen.findByText("Nada para listar ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Baixar PDF" })).not.toBeInTheDocument();
  });

  it("copies the list as plain text", async () => {
    const user = await mount([dietWith(["mon", "wed"])]);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    await user.click(await screen.findByRole("button", { name: "Copiar texto" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        [
          "Lista de compras da semana",
          "",
          "Dietas: Treino (Seg, Qua)",
          "",
          "Proteínas",
          "- Peito de frango grelhado: 1,4 kg",
        ].join("\n"),
      );
    });
  });

  it("downloads the list as a PDF file", async () => {
    const user = await mount([dietWith(["mon", "wed"])]);
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:lista";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    await user.click(await screen.findByRole("button", { name: "Baixar PDF" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.type).toBe("application/pdf");
    expect(await blobs[0]!.text()).toMatch(/^%PDF-1\.4/);
  });
});
