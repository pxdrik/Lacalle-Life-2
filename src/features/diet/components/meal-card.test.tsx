import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Meal, MealItem } from "../types/diet";
import { MealCard } from "./meal-card";

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: "i1",
    foodId: "abacate",
    name: "Abacate",
    grams: 100,
    unit: "g",
    per100g: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 },
    ...overrides,
  };
}

function meal(items: readonly MealItem[]): Meal {
  return { id: "m1", name: "Refeição 1", time: null, notes: "", items };
}

function mount(
  theMeal: Meal,
  extra: {
    readonly position?: number;
    readonly total?: number;
    readonly onRemove?: () => void;
    readonly onDuplicate?: () => void;
    readonly onMove?: (offset: number) => void;
    readonly checkState?: "unchecked" | "checked" | "edited";
    readonly onToggleChecked?: () => void;
    readonly onSaveAlternative?: (name: string) => void;
    readonly onApplyAlternative?: (alternativeId: string) => void;
    readonly onRenameAlternative?: (alternativeId: string, name: string) => void;
    readonly onRemoveAlternative?: (alternativeId: string) => void;
  } = {},
) {
  const card = (theMeal: Meal) => (
    <MealCard
      meal={theMeal}
      position={0}
      total={1}
      dragHandle={{ attributes: {}, listeners: undefined, isDragging: false }}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      onDuplicate={vi.fn()}
      onMove={vi.fn()}
      onAddFoodClick={vi.fn()}
      onItemGramsChange={vi.fn()}
      onRemoveItem={vi.fn()}
      onReorderItems={vi.fn()}
      otherMeals={[]}
      onSendItem={vi.fn()}
      {...extra}
    />
  );

  const { rerender } = render(card(theMeal));

  return {
    /** Re-renders with a different meal — same other props. */
    update: (nextMeal: Meal) => {
      rerender(card(nextMeal));
    },
  };
}

describe("the check button", () => {
  it("does not render without onToggleChecked", () => {
    mount(meal([]));

    expect(
      screen.queryByRole("button", { name: /Marcar|Desmarcar/ }),
    ).not.toBeInTheDocument();
  });

  it("renders unchecked and calls back on click", async () => {
    const onToggleChecked = vi.fn();
    mount(meal([]), { checkState: "unchecked", onToggleChecked });

    const button = screen.getByRole("button", {
      name: "Marcar Refeição 1 como comida",
    });
    expect(button).toHaveAttribute("aria-pressed", "false");

    button.click();
    expect(onToggleChecked).toHaveBeenCalledTimes(1);
  });

  it("reads as checked when told to", () => {
    mount(meal([]), { checkState: "checked", onToggleChecked: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Desmarcar Refeição 1 como comida" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("reads as edited, with a different icon, once the log diverges from the plan", () => {
    mount(meal([]), { checkState: "edited", onToggleChecked: vi.fn() });

    const button = screen.getByRole("button", {
      name: "Desmarcar Refeição 1 como comida",
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("title", "Comido, mas diferente do planejado");
  });

});

describe("other suggestions", () => {
  it("does not render without onApplyAlternative — a checked day has nothing to suggest", () => {
    mount(meal([]));

    expect(
      screen.queryByRole("button", { name: /Outras sugestões/ }),
    ).not.toBeInTheDocument();
  });

  it("opens to an empty state when nothing was saved yet", async () => {
    const user = userEvent.setup();
    mount(meal([item()]), { onApplyAlternative: vi.fn() });

    await user.click(screen.getByRole("button", { name: /Outras sugestões/ }));

    expect(
      screen.getByText(/Nenhuma sugestão salva ainda/),
    ).toBeInTheDocument();
  });

  it("saves the current foods under the typed name", async () => {
    const user = userEvent.setup();
    const onSaveAlternative = vi.fn();
    mount(meal([item()]), {
      onApplyAlternative: vi.fn(),
      onSaveAlternative,
    });

    await user.click(screen.getByRole("button", { name: /Outras sugestões/ }));
    await user.type(
      screen.getByLabelText("Nome da nova sugestão"),
      "Marmita de arroz",
    );
    await user.click(screen.getByRole("button", { name: "Salvar atual" }));

    expect(onSaveAlternative).toHaveBeenCalledExactlyOnceWith(
      "Marmita de arroz",
    );
  });

  it("lists a saved suggestion and applies it on 'Usar'", async () => {
    const user = userEvent.setup();
    const onApplyAlternative = vi.fn();
    const withAlternative: Meal = {
      ...meal([item()]),
      alternatives: [
        {
          id: "alt-1",
          name: "Marmita de macarrão",
          items: [item({ id: "i2", name: "Macarrão" })],
        },
      ],
    };
    mount(withAlternative, { onApplyAlternative });

    await user.click(screen.getByRole("button", { name: /Outras sugestões/ }));

    expect(screen.getByDisplayValue("Marmita de macarrão")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Usar" }));

    expect(onApplyAlternative).toHaveBeenCalledExactlyOnceWith("alt-1");
  });
});

describe("the actions menu (⋮)", () => {
  // Regressão real que este bloco existe pra pegar de novo (comentário do
  // topo do arquivo): "Duplicar" já esteve ligado em `addMeal` por engano,
  // produzindo uma refeição vazia em vez de uma cópia — silenciosamente, na
  // tela onde a pessoa registra o que de fato comeu. Reorganizar os quatro
  // botões atrás do ⋮ (17/09/2026) é exatamente o tipo de mudança que
  // reintroduziria esse bug se um dos quatro ficasse ligado à ação errada.
  async function openMenu() {
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Mais ações para Refeição 1" }),
    );
    return user;
  }

  it("duplicar chama onDuplicate, e só onDuplicate", async () => {
    const onDuplicate = vi.fn();
    mount(meal([]), { onDuplicate });
    const user = await openMenu();

    await user.click(screen.getByRole("button", { name: "Duplicar" }));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("mover para cima chama onMove(-1)", async () => {
    const onMove = vi.fn();
    mount(meal([]), { onMove, position: 1, total: 2 });
    const user = await openMenu();

    await user.click(screen.getByRole("button", { name: "Mover para cima" }));

    expect(onMove).toHaveBeenCalledExactlyOnceWith(-1);
  });

  it("mover para baixo chama onMove(1)", async () => {
    const onMove = vi.fn();
    mount(meal([]), { onMove, position: 0, total: 2 });
    const user = await openMenu();

    await user.click(screen.getByRole("button", { name: "Mover para baixo" }));

    expect(onMove).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("desabilita mover para cima na primeira posição, e para baixo na última", async () => {
    mount(meal([]), { position: 0, total: 1 });
    await openMenu();

    expect(screen.getByRole("button", { name: "Mover para cima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mover para baixo" })).toBeDisabled();
  });

  it("excluir pede confirmação antes de chamar onRemove", async () => {
    const onRemove = vi.fn();
    mount(meal([]), { onRemove });
    const user = await openMenu();

    const remove = screen.getByRole("button", { name: "Excluir Refeição 1" });
    await user.click(remove);
    expect(onRemove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Excluir?: Excluir Refeição 1" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("the newly added item's entrance", () => {
  it("does not animate on the initial render — nothing was just added", () => {
    mount(meal([item({ id: "i1" })]));

    // `getAllByText`, não `getByText`: o mesmo nome também é o título do
    // `Dialog` de ações do item (sempre no DOM, só fechado) — o primeiro
    // elemento é o `<span>` da linha.
    const row = screen.getAllByText("Abacate")[0]?.closest("li");
    expect(row).not.toHaveClass("animate-rise");
  });

  it("animates only the item that was appended", () => {
    const { update } = mount(meal([item({ id: "i1" })]));

    update(
      meal([item({ id: "i1" }), item({ id: "i2", name: "Banana" })]),
    );

    const existing = screen.getAllByText("Abacate")[0]?.closest("li");
    const added = screen.getAllByText("Banana")[0]?.closest("li");
    expect(existing).not.toHaveClass("animate-rise");
    expect(added).toHaveClass("animate-rise");
  });
});
