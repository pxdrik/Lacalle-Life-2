import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { WeightField } from "./weight-field";

/**
 * Typing a decimal weight, which the obvious implementation makes impossible.
 *
 * A controlled input whose value is re-derived from the parsed number drops
 * the separator the moment it is typed — and the next digit lands on the wrong
 * side of it. These tests type character by character, because that is the
 * only way the bug shows: setting the whole string at once never reproduces it.
 */

/** Wired to state, like the real callers, so re-renders actually happen. */
function Harness({ initial = null }: { readonly initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial);

  return (
    <>
      <WeightField value={value} label="Peso" onChange={setValue} />
      <output>{value === null ? "vazio" : String(value)}</output>
    </>
  );
}

const field = () => screen.getByLabelText("Peso");
const parsed = () => screen.getByRole("status").textContent;

describe("typing a weight with a comma", () => {
  it("keeps the comma on screen while it is typed", async () => {
    render(<Harness />);

    await userEvent.type(field(), "62,");

    expect(field()).toHaveValue("62,");
  });

  it("reaches 62,5 rather than 625", async () => {
    // The phone case: 6, 2, comma, 5. With the separator swallowed, the 5
    // joined the 62 and the set was recorded at 625 kg.
    render(<Harness />);

    await userEvent.type(field(), "62,5");

    expect(field()).toHaveValue("62,5");
    expect(parsed()).toBe("62.5");
  });

  it("accepts a dot too, since a desktop keyboard offers that one", async () => {
    render(<Harness />);

    await userEvent.type(field(), "62.5");

    expect(parsed()).toBe("62.5");
  });
});

describe("typing a minus sign", () => {
  // Found by an external audit (27/08/2026): typing "-20" was accepted as a
  // real weight, and the negative set silently *subtracted* from the Volume
  // total in Evolução instead of failing anywhere visible.
  it("never lets the character land in the field", async () => {
    render(<Harness />);

    await userEvent.type(field(), "-20");

    expect(field()).toHaveValue("20");
    expect(parsed()).toBe("20");
  });

  it("drops a leading minus and keeps the rest of the number", async () => {
    render(<Harness />);

    await userEvent.type(field(), "-62,5");

    expect(field()).toHaveValue("62,5");
    expect(parsed()).toBe("62.5");
  });

  it("still accepts zero and ordinary positive decimals", async () => {
    render(<Harness />);
    await userEvent.type(field(), "0");
    expect(parsed()).toBe("0");
  });
});

describe("when the value changes from outside", () => {
  it("shows the new number, because a stepper moved it", async () => {
    function Stepper() {
      const [value, setValue] = useState<number | null>(60);
      return (
        <>
          <WeightField value={value} label="Peso" onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue(62.5);
            }}
          >
            +2,5
          </button>
        </>
      );
    }

    render(<Stepper />);
    await userEvent.click(screen.getByRole("button", { name: "+2,5" }));

    expect(field()).toHaveValue("62,5");
  });
});

describe("clearing the field", () => {
  it("reports null rather than zero, so an empty set stays empty", async () => {
    render(<Harness initial={60} />);

    await userEvent.clear(field());

    expect(parsed()).toBe("vazio");
  });
});

describe("the label", () => {
  it("names the field for assistive technology", () => {
    render(
      <WeightField
        value={null}
        label="Peso da série 1 de Supino"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText("Peso da série 1 de Supino"),
    ).toBeInTheDocument();
  });
});
