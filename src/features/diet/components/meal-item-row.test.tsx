import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MealItem } from "../types/diet";
import { MealItemRow } from "./meal-item-row";

/**
 * The portion field, which stored ten times what was typed.
 *
 * `12,5` became `125` because the field kept digits and threw everything else
 * away, separator included. It is the most repeated input in the app and the
 * error is invisible: 125 g is an ordinary portion, so nothing on the screen
 * looks wrong while the calories, the three macros, the day's total and the
 * ring are all a factor of ten out.
 *
 * The tests type character by character rather than setting a value, because
 * the failure only exists while typing: a field that parses correctly but is
 * re-rendered from the stored number loses the comma between one keystroke and
 * the next.
 */

const ITEM: MealItem = {
  id: "i1",
  foodId: "abacate",
  name: "Abacate",
  grams: 0,
  unit: "g",
  per100g: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 },
};

function mount(item: MealItem = ITEM) {
  const onGramsChange = vi.fn();
  const onUnitChange = vi.fn();

  render(
    <ul>
      <MealItemRow
        item={item}
        dragHandle={{ attributes: {}, listeners: undefined, isDragging: false }}
        otherMeals={[]}
        onGramsChange={onGramsChange}
        onUnitChange={onUnitChange}
        onRemove={() => undefined}
        onSend={() => undefined}
      />
    </ul>,
  );

  return {
    field: screen.getByLabelText("Quantidade de Abacate"),
    unitField: screen.getByLabelText("Unidade de Abacate"),
    onGramsChange,
    onUnitChange,
  };
}

const last = (fn: ReturnType<typeof vi.fn>): unknown =>
  fn.mock.calls.at(-1)?.[0];

describe("the portion field", () => {
  it("stores 12,5 as twelve and a half, not as a hundred and twenty-five", async () => {
    const { field, onGramsChange } = mount();

    await userEvent.type(field, "12,5");

    expect(last(onGramsChange)).toBe(12.5);
  });

  it("keeps the comma on screen while the rest of the number is typed", async () => {
    // The half that parsing alone does not fix. Re-rendering from the stored
    // number turns "12," back into "12", and the next digit lands on the wrong
    // side of the separator.
    const { field } = mount();

    await userEvent.type(field, "12,");

    expect(field).toHaveValue("12,");
  });

  it("accepts a full stop, because a desktop keyboard has one", async () => {
    const { field, onGramsChange } = mount();

    await userEvent.type(field, "12.5");

    expect(last(onGramsChange)).toBe(12.5);
    expect(field).toHaveValue("12,5");
  });

  it("refuses a minus sign at entry rather than storing a negative portion", async () => {
    // The old behaviour was right about this and wrong about how: stripping
    // every non-digit removed the sign and the separator together.
    const { field, onGramsChange } = mount();

    await userEvent.type(field, "-12,5");

    expect(last(onGramsChange)).toBe(12.5);
    expect(field).toHaveValue("12,5");
  });

  it("refuses letters, so a pasted label cannot become a number", async () => {
    const { field, onGramsChange } = mount();

    await userEvent.type(field, "12g");

    expect(last(onGramsChange)).toBe(12);
    expect(field).toHaveValue("12");
  });

  it("keeps only the first separator", async () => {
    const { field, onGramsChange } = mount();

    await userEvent.type(field, "1,2,3");

    expect(last(onGramsChange)).toBe(1.23);
  });

  it("is empty rather than showing a zero nobody typed", () => {
    const { field } = mount();

    expect(field).toHaveValue("");
  });

  it("shows a stored decimal with a comma, like the rest of the app", () => {
    const { field } = mount({ ...ITEM, grams: 62.5 });

    expect(field).toHaveValue("62,5");
  });

  it("caps a pasted number and shows the cap, so field and store agree", async () => {
    const { field, onGramsChange } = mount();

    await userEvent.type(field, "99999999");

    expect(last(onGramsChange)).toBe(100_000);
    expect(field).toHaveValue("100000");
  });

  it("clears to zero when the field is emptied", async () => {
    const { field, onGramsChange } = mount({ ...ITEM, grams: 200 });

    await userEvent.clear(field);

    expect(last(onGramsChange)).toBe(0);
  });
});

describe("the unit selector", () => {
  it("defaults to grams", () => {
    const { unitField } = mount();

    expect(unitField).toHaveValue("g");
  });

  it("switches to millilitres without changing the stored quantity", async () => {
    // 1 ml ≈ 1 g is the whole approximation — the number itself never moves,
    // only the label. `onGramsChange` must not fire from a unit change.
    const { unitField, onUnitChange, onGramsChange } = mount({
      ...ITEM,
      grams: 250,
    });

    await userEvent.selectOptions(unitField, "ml");

    expect(onUnitChange).toHaveBeenCalledWith("ml");
    expect(onGramsChange).not.toHaveBeenCalled();
  });

  it("shows ml when the item is already stored that way", () => {
    const { unitField } = mount({ ...ITEM, unit: "ml" });

    expect(unitField).toHaveValue("ml");
  });
});
