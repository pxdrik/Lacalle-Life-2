import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Meal, MealAlternative, MealItem } from "../types/diet";
import { MealAlternativesDialog } from "./meal-alternatives-dialog";

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

function alternative(overrides: Partial<MealAlternative> = {}): MealAlternative {
  return { id: "alt1", name: "Marmita de arroz", items: [item()], ...overrides };
}

function meal(alternatives: readonly MealAlternative[]): Meal {
  return {
    id: "m1",
    name: "Refeição 1",
    time: null,
    notes: "",
    items: [],
    alternatives,
  };
}

describe("Delete/Collapse — removing a saved alternative shrinks before it goes", () => {
  it("does not remove on confirmation alone — only once the row finishes shrinking", async () => {
    const onRemove = vi.fn();
    render(
      <MealAlternativesDialog
        meal={meal([alternative()])}
        open
        onClose={vi.fn()}
        onApply={vi.fn()}
        onSave={vi.fn()}
        onRename={vi.fn()}
        onRemove={onRemove}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Excluir sugestão Marmita de arroz" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Excluir?: Excluir sugestão Marmita de arroz",
      }),
    );
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.transitionEnd(
      screen.getByRole("button", { name: "Usar" }).closest("li")!,
      { propertyName: "grid-template-rows" },
    );
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("alt1");
  });
});
