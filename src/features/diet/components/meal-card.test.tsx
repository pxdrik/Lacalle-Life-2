import { render, screen } from "@testing-library/react";
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
  extra: { readonly checked?: boolean; readonly onToggleChecked?: () => void } = {},
) {
  render(
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
    />,
  );
}

const EXPLANATION = /Gramas é o peso do alimento/;

describe("the check button", () => {
  it("does not render on the diet's own screen without onToggleChecked", () => {
    mount(meal([]));

    expect(
      screen.queryByRole("button", { name: /Marcar|Desmarcar/ }),
    ).not.toBeInTheDocument();
  });

  it("renders unchecked and calls back on click", async () => {
    const onToggleChecked = vi.fn();
    mount(meal([]), { checked: false, onToggleChecked });

    const button = screen.getByRole("button", {
      name: "Marcar Refeição 1 como comida",
    });
    expect(button).toHaveAttribute("aria-pressed", "false");

    button.click();
    expect(onToggleChecked).toHaveBeenCalledTimes(1);
  });

  it("reads as checked when told to", () => {
    mount(meal([]), { checked: true, onToggleChecked: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Desmarcar Refeição 1 como comida" }),
    ).toHaveAttribute("aria-pressed", "true");
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
