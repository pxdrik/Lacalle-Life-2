import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { FoodRepositoryProvider } from "../data/food-repository-context";
import { FOODS_STORE } from "../data/food-store";
import { LocalFoodRepository } from "../data/local-food-repository";
import type { Food } from "../types/food";
import { FoodSelectionScreen } from "./food-selection-screen";

const mockPush = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => mockSearchParams(),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockSearchParams.mockReturnValue(new URLSearchParams());
});

function food(name: string, overrides: Partial<Food> = {}): Food {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    category: "protein",
    unit: "g",
    per100g: { kcal: 200, proteinG: 20, carbsG: 10, fatG: 5 },
    isCustom: false,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

async function afterLoad() {
  await waitFor(() => {
    expect(
      screen.getByLabelText("Buscar alimento para adicionar"),
    ).not.toBeDisabled();
  });
}

function mount(foods: readonly Food[] = []) {
  const repository = new LocalFoodRepository(
    new MemoryStore<Food>(FOODS_STORE),
  );

  render(
    <FoodRepositoryProvider
      repository={Promise.all(
        foods.map((item) => repository.save(item, null)),
      ).then(() => repository)}
    >
      <FoodSelectionScreen />
    </FoodRepositoryProvider>,
  );
}

describe("FoodSelectionScreen", () => {
  it("shows a notice instead of the picker when mealId is missing", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams({ returnTo: "/diario" }));
    mount();

    expect(
      screen.getByText("Nada para adicionar aqui — volte e tente de novo."),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Buscar alimento para adicionar"),
    ).not.toBeInTheDocument();
  });

  it("Voltar navigates to returnTo, falling back to /diario when absent", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams({ mealId: "m1" }));
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(mockPush).toHaveBeenCalledWith("/diario");
  });

  it("never treats a protocol-relative returnTo as a real path", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "//evil.example.com" }),
    );
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(mockPush).toHaveBeenCalledWith("/diario");
  });

  it("picking a food opens the quantity step, prefilled with its reference portion", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "/dietas/abc" }),
    );
    mount([
      food("Pão francês", {
        practicalUnit: { label: "1 unidade", grams: 50 },
      }),
    ]);
    await afterLoad();

    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "pão",
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Pão francês/ }),
    );

    expect(screen.getByRole("heading", { name: "Pão francês" })).toBeInTheDocument();
    expect(screen.getByLabelText("Gramas")).toHaveValue("50");
  });

  it("labels the field Mililitros for a liquid food", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "/dietas/abc" }),
    );
    mount([food("Água de coco", { unit: "ml", category: "beverage" })]);
    await afterLoad();

    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "água",
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Água de coco/ }),
    );

    expect(screen.getByLabelText("Mililitros")).toBeInTheDocument();
    expect(screen.queryByLabelText("Gramas")).not.toBeInTheDocument();
  });

  it("confirming the quantity navigates back with the food, meal and grams", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "/dietas/abc" }),
    );
    mount([food("Frango")]);
    await afterLoad();

    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "frango",
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Frango/ }),
    );

    const grams = screen.getByLabelText("Gramas");
    await userEvent.clear(grams);
    await userEvent.type(grams, "150");
    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar à refeição" }),
    );

    expect(mockPush).toHaveBeenCalledWith(
      "/dietas/abc?addFoodId=frango&addMealId=m1&addGrams=150",
    );
  });

  it("keeps returnTo's own query string when appending the add* params", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        mealId: "m1",
        returnTo: "/diario?dia=2026-09-20",
      }),
    );
    mount([food("Ovo")]);
    await afterLoad();

    await userEvent.click(
      screen.getByRole("button", { name: "Criar alimento" }),
    );
    // Cancel out of create and pick the seeded food instead — simplest path
    // to the quantity step without retyping the search.
    await userEvent.click(screen.getByRole("button", { name: "Voltar à busca" }));
    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "ovo",
    );
    await userEvent.click(await screen.findByRole("button", { name: /Ovo/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar à refeição" }),
    );

    const [url] = mockPush.mock.calls.at(-1) ?? [];
    expect(url).toContain("dia=2026-09-20");
    expect(url).toContain("addFoodId=ovo");
  });

  it("'Trocar alimento' returns to search without navigating away", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "/dietas/abc" }),
    );
    mount([food("Arroz")]);
    await afterLoad();

    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "arroz",
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Arroz/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Trocar alimento" }),
    );

    expect(
      screen.getByLabelText("Buscar alimento para adicionar"),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("disables the confirm button while grams is zero", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "/dietas/abc" }),
    );
    mount([food("Batata doce")]);
    await afterLoad();

    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "batata",
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Batata doce/ }),
    );

    await userEvent.clear(screen.getByLabelText("Gramas"));

    expect(
      screen.getByRole("button", { name: "Adicionar à refeição" }),
    ).toBeDisabled();
  });
});
