import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FoodRepositoryProvider } from "../data/food-repository-context";
import type { FoodRepository } from "../data/food-repository";
import type { Food } from "../types/food";
import { FoodPicker } from "./food-picker";

// `CustomFoodForm` calls `useRouter()` unconditionally (it is also the
// standalone /alimentos screen) even though the "create inline" path below
// never lets it navigate — same mock `custom-food-form.test.tsx` uses.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function food(name: string, overrides: Partial<Food> = {}): Food {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    category: "protein",
    unit: "g",
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

  it("shows a long food name in full, not clipped to one truncated line", async () => {
    const longName =
      "Abadejo filé congelado grelhado com farinha de trigo e legumes";
    mount([food(longName)]);
    await afterLoad();

    const row = await screen.findByRole("button", {
      name: new RegExp(longName),
    });
    // The old row put the name in a `truncate` span; the whole name has to
    // be readable now, not clipped behind an ellipsis.
    const nameSpan = row.querySelector("span > span");
    expect(nameSpan?.className).not.toContain("truncate");
    expect(row).toHaveTextContent(longName);
  });

  it("keeps the whole row as one clickable control, even with a wrapped multi-line name", async () => {
    const longName = "Abadejo filé congelado grelhado com farinha de trigo";
    const { onPick } = mount([food(longName)]);
    await afterLoad();

    await userEvent.click(
      await screen.findByRole("button", { name: new RegExp(longName) }),
    );

    expect(onPick).toHaveBeenCalledOnce();
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

describe("showing the reference portion and macros", () => {
  it("scales to the practical unit when the food has one, instead of the raw 100 g", async () => {
    mount([
      food("Pão francês", {
        per100g: { kcal: 300, proteinG: 8, carbsG: 60, fatG: 3 },
        practicalUnit: { label: "1 unidade", grams: 50 },
      }),
    ]);
    await afterLoad();

    const row = await screen.findByRole("button", { name: /Pão francês/ });
    // Half of 100 g, since the unit weighs 50 g — 150 kcal, not 300.
    expect(row).toHaveTextContent("1 unidade");
    expect(row).toHaveTextContent("150 kcal");
  });

  it("falls back to 100 g when the food has no practical unit", async () => {
    mount([food("Peito de frango", { per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 } })]);
    await afterLoad();

    const row = await screen.findByRole("button", { name: /Peito de frango/ });
    expect(row).toHaveTextContent("100 g");
    expect(row).toHaveTextContent("165 kcal");
  });
});

describe("creating a food without leaving the picker", () => {
  it("carries the search text into the name field", async () => {
    mount([food("Banana")]);
    await afterLoad();

    await userEvent.type(
      screen.getByLabelText("Buscar alimento para adicionar"),
      "Whey caseiro",
    );
    await userEvent.click(
      screen.getByRole("button", { name: 'Criar "Whey caseiro"' }),
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Whey caseiro");
  });

  it("saves through the same service as /alimentos, then picks the new food and returns to search", async () => {
    const { onPick } = mount([food("Banana")]);
    await afterLoad();

    await userEvent.click(
      screen.getByRole("button", { name: "Criar alimento" }),
    );
    await userEvent.type(screen.getByLabelText("Nome"), "Barra proteica");
    await userEvent.type(screen.getByLabelText("Calorias"), "100");
    await userEvent.type(screen.getByLabelText("Proteína"), "10");
    await userEvent.type(screen.getByLabelText("Carboidrato"), "10");
    await userEvent.type(screen.getByLabelText("Gordura"), "1");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alimento" }),
    );

    await waitFor(() => {
      expect(onPick).toHaveBeenCalledOnce();
    });
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({ name: "Barra proteica" });
    // Back to the search UI, not left on the form.
    expect(
      screen.getByLabelText("Buscar alimento para adicionar"),
    ).toBeInTheDocument();
  });

  it("goes back to search on cancel, without saving anything", async () => {
    mount([food("Banana")]);
    await afterLoad();

    await userEvent.click(
      screen.getByRole("button", { name: "Criar alimento" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.getByLabelText("Buscar alimento para adicionar"),
    ).toBeInTheDocument();
  });
});

/**
 * Roadmap 7.2 (30/09/2026): "Recentes" acima da lista, com a busca vazia.
 * É o histórico da própria pessoa, montado pelo diário; o seletor só mostra.
 */
describe("FoodPicker — Recentes", () => {
  const arroz = food("Arroz");
  const feijao = food("Feijão");
  const frango = food("Frango");
  const RECENTS = [
    { foodId: feijao.id, grams: 120, detail: "Ontem · Almoço · 120 g" },
    { foodId: "apagado", grams: 50, detail: "Ontem · Almoço · 50 g" },
    { foodId: arroz.id, grams: 200, detail: "Ontem · Almoço · 200 g" },
  ];

  function mountWithRecents(onPick = vi.fn()) {
    const repository: FoodRepository = {
      listAll: vi.fn().mockResolvedValue([arroz, feijao, frango]),
      getById: vi.fn(),
      save: vi.fn(),
      saveMany: vi.fn(),
      remove: vi.fn(),
      isEmpty: vi.fn().mockResolvedValue(false),
    };
    render(
      <FoodRepositoryProvider repository={Promise.resolve(repository)}>
        <FoodPicker onPick={onPick} onCancel={vi.fn()} recents={RECENTS} />
      </FoodRepositoryProvider>,
    );
    return onPick;
  }

  const recentsList = () =>
    screen.queryByRole("region", { name: "Recentes" });

  it("mostra os recentes na ordem, e só os que ainda existem no catálogo", async () => {
    mountWithRecents();
    await afterLoad();

    const region = recentsList();
    expect(region).not.toBeNull();
    const rows = [...region!.querySelectorAll("button")].map((b) => b.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Feijão");
    expect(rows[0]).toContain("Ontem · Almoço · 120 g");
    expect(rows[1]).toContain("Arroz");
  });

  it("tocar num recente entrega o alimento com a quantidade da última vez", async () => {
    const onPick = mountWithRecents();
    await afterLoad();

    await userEvent.click(
      [...recentsList()!.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Feijão"),
      )!,
    );

    expect(onPick).toHaveBeenCalledWith(feijao, 120);
  });

  it("some ao digitar, porque buscar é procurar outra coisa", async () => {
    mountWithRecents();
    await afterLoad();

    await userEvent.type(screen.getByLabelText("Buscar alimento para adicionar"), "fr");

    expect(recentsList()).toBeNull();
  });

  it("sem recentes, o seletor é o de antes", async () => {
    mount([arroz, feijao]);
    await afterLoad();

    expect(recentsList()).toBeNull();
    expect(screen.queryByText("Todos os alimentos")).toBeNull();
  });
});
