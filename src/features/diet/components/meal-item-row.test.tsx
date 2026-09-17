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

function row(item: MealItem) {
  return (
    <ul>
      <MealItemRow
        item={item}
        dragHandle={{ attributes: {}, listeners: undefined, isDragging: false }}
        otherMeals={[]}
        onGramsChange={() => undefined}
        onRemove={() => undefined}
        onSend={() => undefined}
      />
    </ul>
  );
}

function mount(item: MealItem = ITEM) {
  const onGramsChange = vi.fn();

  const { rerender } = render(
    <ul>
      <MealItemRow
        item={item}
        dragHandle={{ attributes: {}, listeners: undefined, isDragging: false }}
        otherMeals={[]}
        onGramsChange={onGramsChange}
        onRemove={() => undefined}
        onSend={() => undefined}
      />
    </ul>,
  );

  return {
    field: screen.getByLabelText("Quantidade de Abacate"),
    onGramsChange,
    rerender: (next: MealItem) => {
      rerender(row(next));
    },
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

describe("the portion reference", () => {
  // 17/09/2026, Pedro: "não precisa de botar adicionar 1 porção" — a medida
  // caseira é só texto, nunca um segundo campo, e a pessoa só ajusta a
  // gramatura no `GramsField` acima.
  const WITH_UNIT: MealItem = {
    ...ITEM,
    grams: 100,
    practicalUnit: { label: "1/2 unidade média", grams: 100 },
  };

  it("does not show when the food has no practical unit", () => {
    mount(ITEM);

    expect(screen.queryByText(/unidade média/)).not.toBeInTheDocument();
  });

  it("shows the reference as plain text, not an editable field", () => {
    mount(WITH_UNIT);

    expect(
      screen.getByText("1/2 unidade média = 100 g"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Quantidade de Abacate em 1/2 unidade média"),
    ).not.toBeInTheDocument();
  });

  it("never changes when the stored grams change — it is the food's own reference, not a live count", () => {
    const { rerender } = mount(WITH_UNIT);

    rerender({ ...WITH_UNIT, grams: 250 });

    expect(
      screen.getByText("1/2 unidade média = 100 g"),
    ).toBeInTheDocument();
  });

  it("reads in millilitres for a liquid food", () => {
    mount({
      ...WITH_UNIT,
      unit: "ml",
      practicalUnit: { label: "1 copo", grams: 200 },
    });

    expect(screen.getByText("1 copo = 200 ml")).toBeInTheDocument();
  });
});

describe("the unit label", () => {
  it("shows g for a solid food, next to the grams field", () => {
    mount();

    expect(screen.getByText("g")).toBeInTheDocument();
  });

  it("shows ml for a liquid food", () => {
    mount({ ...ITEM, unit: "ml" });

    expect(screen.getByText("ml")).toBeInTheDocument();
  });
});

describe("the food name", () => {
  // Reversão deliberada, 17/09/2026: a linha do item agora compartilha
  // espaço com o kcal e o ⋮ (pedido do Pedro, comparando com o Macros —
  // "a distribuição dos macros tá muito ruim, ocupa muito espaço"), então
  // truncar é o preço certo pra caber em duas linhas fixas em vez de três
  // variáveis. Diferente do `FoodPicker`: ali o nome inteiro decide *qual*
  // alimento escolher entre vários parecidos; aqui o alimento já foi
  // escolhido, e o nome só precisa ser reconhecível, não soletrado.
  it("truncates a long name to keep the row to two lines", () => {
    // `getAllByText`, não `getByText`: o mesmo nome também é o título do
    // `Dialog` do ⋮ (sempre no DOM, só fechado) — o `<span>` da linha é o
    // primeiro elemento, o `<h2>` do título é o segundo.
    const longName = "Leite semidesnatado em pó integral fortificado";
    render(row({ ...ITEM, name: longName }));

    const [nameSpan] = screen.getAllByText(longName);
    expect(nameSpan?.className).toContain("truncate");
  });
});

describe("the actions menu (⋮)", () => {
  function mountWithMenu(
    otherMeals: readonly { readonly id: string; readonly name: string }[] = [],
    extra: {
      readonly onSend?: (targetMealId: string, mode: "copy" | "move") => void;
      readonly onRemove?: () => void;
    } = {},
  ) {
    const onSend = extra.onSend ?? vi.fn();
    const onRemove = extra.onRemove ?? vi.fn();

    render(
      <ul>
        <MealItemRow
          item={ITEM}
          dragHandle={{
            attributes: {},
            listeners: undefined,
            isDragging: false,
          }}
          otherMeals={otherMeals}
          onGramsChange={() => undefined}
          onRemove={onRemove}
          onSend={onSend}
        />
      </ul>,
    );

    return { onSend, onRemove };
  }

  async function openMenu() {
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Mais ações para Abacate" }),
    );
    return user;
  }

  it("lists every other meal under Mover para and Copiar para", async () => {
    mountWithMenu([{ id: "m2", name: "Refeição 2" }]);
    await openMenu();

    expect(screen.getByText("Mover para")).toBeInTheDocument();
    expect(screen.getByText("Copiar para")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Refeição 2" }),
    ).toHaveLength(2);
  });

  it("moving calls onSend with mode 'move' and closes the sheet", async () => {
    const { onSend } = mountWithMenu([{ id: "m2", name: "Refeição 2" }]);
    const user = await openMenu();

    await user.click(screen.getAllByRole("button", { name: "Refeição 2" })[0]!);

    expect(onSend).toHaveBeenCalledExactlyOnceWith("m2", "move");
    expect(
      screen.queryByRole("button", { name: "Refeição 2" }),
    ).not.toBeInTheDocument();
  });

  it("copying calls onSend with mode 'copy'", async () => {
    const { onSend } = mountWithMenu([{ id: "m2", name: "Refeição 2" }]);
    const user = await openMenu();

    await user.click(screen.getAllByRole("button", { name: "Refeição 2" })[1]!);

    expect(onSend).toHaveBeenCalledExactlyOnceWith("m2", "copy");
  });

  it("has no Mover/Copiar section when there is nowhere to send the food", async () => {
    mountWithMenu([]);
    await openMenu();

    expect(screen.queryByText("Mover para")).not.toBeInTheDocument();
    expect(screen.queryByText("Copiar para")).not.toBeInTheDocument();
  });

  it("removing requires confirmation before calling onRemove", async () => {
    const { onRemove } = mountWithMenu();
    const user = await openMenu();

    const remove = screen.getByRole("button", { name: "Remover Abacate" });
    await user.click(remove);
    expect(onRemove).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Remover?: Remover Abacate" }),
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
