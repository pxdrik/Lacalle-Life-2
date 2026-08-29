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

function mount(theMeal: Meal) {
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
    />,
  );
}

const EXPLANATION = /O primeiro número é sempre o peso/;

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
