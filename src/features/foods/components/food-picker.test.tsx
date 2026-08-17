import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FoodRepositoryProvider } from "../data/food-repository-context";
import type { FoodRepository } from "../data/food-repository";
import type { Food } from "../types/food";
import { FoodPicker } from "./food-picker";

function food(name: string, overrides: Partial<Food> = {}): Food {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    category: "protein",
    per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
    isCustom: false,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

/**
 * Waits for the catalogue to leave "loading", where the search input is
 * `disabled` — typing into a disabled input is a silent no-op, and a test
 * that types immediately after `mount()` can pass by accident (every food
 * still shows up unfiltered) instead of proving the search actually ran.
 */
async function afterLoad() {
  await waitFor(() => {
    expect(screen.getByLabelText("Buscar alimento para adicionar")).not.toBeDisabled();
  });
}

function mount(foods: readonly Food[], onPick = vi.fn(), onCancel = vi.fn()) {
  const repository: FoodRepository = {
    listAll: vi.fn().mockResolvedValue(foods),
    getById: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    remove: vi.fn(),
    isEmpty: vi.fn().mockResolvedValue(false),
  };

  render(
    <FoodRepositoryProvider repository={Promise.resolve(repository)}>
      <FoodPicker onPick={onPick} onCancel={onCancel} />
    </FoodRepositoryProvider>,
  );

  return { onPick, onCancel };
}

describe("FoodPicker", () => {
  it("shows more than 8 matches now that the artificial cap is gone", async () => {
    const foods = [
      ...Array.from({ length: 15 }, (_, i) =>
        food(`Frango variação ${String(i)}`),
      ),
      // Proves the search actually ran — if typing were a no-op, this would
      // show up in the 16-item list too.
      food("Peixe assado"),
    ];
    mount(foods);
    await afterLoad();

    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "frango",
    );

    // All 15 match "frango" — the old picker would have shown 8.
    expect(
      await screen.findAllByRole("button", { name: /Frango variação/ }),
    ).toHaveLength(15);
    expect(
      screen.queryByRole("button", { name: /Peixe assado/ }),
    ).not.toBeInTheDocument();
  });

  it("filters by category through the same Filtros control as the full browser", async () => {
    mount([
      food("Frango grelhado", { category: "protein" }),
      food("Arroz branco", { category: "carb" }),
    ]);
    await afterLoad();

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await userEvent.click(screen.getByRole("button", { name: "Carboidratos" }));

    expect(
      await screen.findByRole("button", { name: /Arroz branco/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Frango grelhado/ }),
    ).not.toBeInTheDocument();
  });

  it("filters to favourites only", async () => {
    mount([
      food("Ovo", { isFavorite: true }),
      food("Tofu", { isFavorite: false }),
    ]);
    await afterLoad();

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await userEvent.click(screen.getByRole("button", { name: "Favoritos" }));

    expect(await screen.findByRole("button", { name: /Ovo/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tofu/ })).not.toBeInTheDocument();
  });

  it("keeps filters active after picking a food, for adding several from the same category", async () => {
    const { onPick } = mount([
      food("Frango grelhado", { category: "protein" }),
      food("Peixe assado", { category: "protein" }),
    ]);
    await afterLoad();

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await userEvent.click(screen.getByRole("button", { name: "Proteínas" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Frango grelhado/ }),
    );

    expect(onPick).toHaveBeenCalledOnce();
    // Still filtered to proteins — Peixe assado is still there to pick next.
    expect(
      await screen.findByRole("button", { name: /Peixe assado/ }),
    ).toBeInTheDocument();
  });

  it("clears the search text after picking, so the next food can be typed straight away", async () => {
    const { onPick } = mount([food("Banana")]);
    await afterLoad();

    const input = screen.getByLabelText("Buscar alimento para adicionar");
    await userEvent.type(input, "banana");
    expect(input).toHaveValue("banana");

    await userEvent.click(await screen.findByRole("button", { name: /Banana/ }));

    expect(onPick).toHaveBeenCalledOnce();
    expect(input).toHaveValue("");
  });

  it("shows a not-found message rather than an empty silence", async () => {
    mount([food("Banana")]);
    await afterLoad();

    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "zzzz",
    );

    expect(
      await screen.findByText("Nenhum alimento encontrado."),
    ).toBeInTheDocument();
  });
});
