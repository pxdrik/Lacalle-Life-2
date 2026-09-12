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
      onAddFood={vi.fn()}
      onItemGramsChange={vi.fn()}
      onItemUnitChange={vi.fn()}
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

const EXPLANATION = /Gramas é o peso do alimento/;

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

describe("the grams-vs-unit explanation", () => {
  it("does not show for a meal with no items", () => {
    mount(meal([]));

    expect(screen.queryByText(EXPLANATION)).not.toBeInTheDocument();
  });

  it("does not show when no item has a practical unit", () => {
    mount(meal([item()]));

    expect(screen.queryByText(EXPLANATION)).not.toBeInTheDocument();
  });

  it("shows once an item has a practical unit", () => {
    mount(
      meal([
        item({ practicalUnit: { label: "1/2 unidade média", grams: 100 } }),
      ]),
    );

    expect(screen.getByText(EXPLANATION)).toBeInTheDocument();
  });
});

describe("the newly added item's entrance", () => {
  it("does not animate on the initial render — nothing was just added", () => {
    mount(meal([item({ id: "i1" })]));

    const row = screen.getByText("Abacate").closest("li");
    expect(row).not.toHaveClass("animate-rise");
  });

  it("animates only the item that was appended", () => {
    const { update } = mount(meal([item({ id: "i1" })]));

    update(
      meal([item({ id: "i1" }), item({ id: "i2", name: "Banana" })]),
    );

    const existing = screen.getByText("Abacate").closest("li");
    const added = screen.getByText("Banana").closest("li");
    expect(existing).not.toHaveClass("animate-rise");
    expect(added).toHaveClass("animate-rise");
  });
});
