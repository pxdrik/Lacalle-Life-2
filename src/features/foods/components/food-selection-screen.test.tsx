import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { FoodRepositoryProvider } from "../data/food-repository-context";
import { FOODS_STORE } from "../data/food-store";
import { LocalFoodRepository } from "../data/local-food-repository";
import type { Food, RecentFood } from "../types/food";
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

function mount(foods: readonly Food[] = [], recents?: readonly RecentFood[]) {
  const repository = new LocalFoodRepository(
    new MemoryStore<Food>(FOODS_STORE),
  );

  render(
    <FoodRepositoryProvider
      repository={Promise.all(
        foods.map((item) => repository.save(item, null)),
      ).then(() => repository)}
    >
      <FoodSelectionScreen recents={recents} />
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

    // Volta para a busca, com o alimento em "Nesta refeição" (02/10/2026):
    // só "Confirmar refeição" leva de volta.
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Buscar alimento para adicionar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar refeição" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/dietas/abc?addMealId=m1&addFoodId=frango&addGrams=150",
    );
  });

  it("vários alimentos numa ida: cada um entra em 'Nesta refeição', dá para tirar, e todos voltam juntos", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "/diario" }),
    );
    mount([food("Arroz"), food("Feijão"), food("Frango")]);
    await afterLoad();

    for (const [name, grams] of [["Arroz", "150"], ["Feijão", "100"], ["Frango", "120"]] as const) {
      const search = screen.getByLabelText("Buscar alimento para adicionar");
      await userEvent.clear(search);
      await userEvent.type(search, name.toLowerCase());
      await userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${name}`) }));
      await userEvent.clear(screen.getByLabelText("Gramas"));
      await userEvent.type(screen.getByLabelText("Gramas"), grams);
      await userEvent.click(screen.getByRole("button", { name: "Adicionar à refeição" }));
    }

    // A conferência abre pela contagem na barra de baixo.
    await userEvent.click(screen.getByRole("button", { name: "3 alimentos" }));
    const meal = await screen.findByRole("dialog", { name: "Nesta refeição" });
    expect(within(meal).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Arroz150 g · 300 kcal",
      "Feijão100 g · 200 kcal",
      "Frango120 g · 240 kcal",
    ]);
    expect(meal).toHaveTextContent("Total: 740 kcal");

    await userEvent.click(within(meal).getByRole("button", { name: "Tirar Feijão" }));
    expect(meal).toHaveTextContent("Total: 540 kcal");

    await userEvent.click(within(meal).getByRole("button", { name: "Confirmar refeição" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/diario?addMealId=m1&addFoodId=arroz&addGrams=150&addFoodId=frango&addGrams=120",
    );
  });

  it("o alimento escolhido fica marcado na lista; tocar de novo troca as gramas, sem repetir", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "/diario" }),
    );
    mount([food("Arroz"), food("Feijão")]);
    await afterLoad();

    await userEvent.click(await screen.findByRole("button", { name: /^Arroz/ }));
    await userEvent.clear(screen.getByLabelText("Gramas"));
    await userEvent.type(screen.getByLabelText("Gramas"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar à refeição" }));

    // No topo, em "Adicionados", e marcado também na lista de todos.
    const top = await screen.findByRole("region", { name: "Adicionados" });
    expect(within(top).getAllByRole("button").map((row) => row.textContent)).toEqual([expect.stringContaining("Adicionado · 150 g")]);
    const [inTop, inAll] = screen.getAllByRole("button", { name: /^Arroz/ });
    expect(inAll).toHaveTextContent("Adicionado · 150 g");
    expect(screen.getByRole("button", { name: /^Feijão/ })).not.toHaveTextContent("Adicionado");

    await userEvent.click(inTop!);
    expect(screen.getByLabelText("Gramas"), "não abriu nas gramas escolhidas").toHaveValue("150");
    await userEvent.clear(screen.getByLabelText("Gramas"));
    await userEvent.type(screen.getByLabelText("Gramas"), "200");
    await userEvent.click(screen.getByRole("button", { name: "Salvar quantidade" }));

    const updated = await screen.findByRole("region", { name: "Adicionados" });
    expect(within(updated).getAllByRole("button"), "o alimento se repetiu").toHaveLength(1);
    expect(within(updated).getByRole("button")).toHaveTextContent("Adicionado · 200 g");

    // Procurando outra coisa, a seção some, e o escolhido continua verde nos resultados.
    await userEvent.type(screen.getByLabelText("Buscar alimento para adicionar"), "arr");
    expect(screen.queryByRole("region", { name: "Adicionados" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Arroz/ })).toHaveTextContent("Adicionado · 200 g");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar refeição" }));
    expect(mockPush).toHaveBeenCalledWith("/diario?addMealId=m1&addFoodId=arroz&addGrams=200");
  });

  it("voltar com alimentos na lista pede um segundo toque antes de descartar", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ mealId: "m1", returnTo: "/diario" }),
    );
    mount([food("Ovo")]);
    await afterLoad();

    await userEvent.type(screen.getByLabelText("Buscar alimento para adicionar"), "ovo");
    await userEvent.click(await screen.findByRole("button", { name: /Ovo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar à refeição" }));

    // O "✕" da busca saía sem confirmar; como página, só "Voltar" sai (02/10/2026).
    expect(screen.queryByRole("button", { name: "Fechar busca" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Voltar sem adicionar" }));
    expect(mockPush, "descartou no primeiro toque").not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Descartar 1 alimento\?/ }));
    expect(mockPush).toHaveBeenCalledWith("/diario");
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
    await userEvent.click(screen.getByRole("button", { name: "Confirmar refeição" }));

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

/** Roadmap 7.2 (30/09/2026): um recente abre a quantidade na da última vez. */
describe("FoodSelectionScreen — Recentes", () => {
  it("começa nas gramas da última vez, não na porção de referência", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams({ mealId: "m1", returnTo: "/diario" }));
    const pao = food("Pão francês", { practicalUnit: { label: "1 unidade", grams: 50 } });
    mount([pao], [{ foodId: pao.id, grams: 120, detail: "Ontem · Café · 120 g" }]);
    await afterLoad();

    await userEvent.click(
      within(screen.getByRole("region", { name: "Recentes" })).getByRole("button", { name: /Pão francês/ }),
    );

    expect(screen.getByLabelText("Gramas")).toHaveValue("120");
  });
});
