import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Food } from "../types/food";
import { FoodRow } from "./food-row";

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: "f1",
    name: "Abacate",
    category: "fruit",
    per100g: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 },
    unit: "g",
    isCustom: true,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function mount(overrides: Partial<Food> = {}) {
  const onRemove = vi.fn();
  render(
    <ul>
      <FoodRow
        food={food(overrides)}
        onToggleFavorite={vi.fn()}
        onRemove={onRemove}
      />
    </ul>,
  );
  return { onRemove };
}

describe("Delete/Collapse — removing a custom food shrinks before it goes", () => {
  it("does not remove on confirmation alone — only once the row finishes shrinking", async () => {
    const { onRemove } = mount();

    await userEvent.click(
      screen.getByRole("button", { name: "Excluir Abacate" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Excluir?: Excluir Abacate" }),
    );
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.transitionEnd(screen.getByText("Abacate").closest("li")!, {
      propertyName: "grid-template-rows",
    });
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "Abacate" }),
    );
  });
});

describe("a catalogue food, not the user's own", () => {
  it("has no delete button at all", () => {
    mount({ isCustom: false });

    expect(
      screen.queryByRole("button", { name: "Excluir Abacate" }),
    ).not.toBeInTheDocument();
  });
});

describe("favouriting", () => {
  const star = () =>
    screen
      .getByRole("button", { name: /Favoritar|dos favoritos/ })
      .querySelector("svg");

  it("does not pop for a row that arrives already favourited", () => {
    mount({ isFavorite: true });

    expect(star()).not.toHaveClass("animate-pop");
  });

  it("pops the moment the star is tapped", async () => {
    mount();

    await userEvent.click(
      screen.getByRole("button", { name: "Favoritar Abacate" }),
    );

    expect(star()).toHaveClass("animate-pop");
  });
});
