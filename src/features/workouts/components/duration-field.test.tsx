import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DurationField } from "./duration-field";

/**
 * Minutes in, seconds out — the same comma-survival technique `WeightField`
 * needs, plus the unit conversion at the edges.
 */

function Harness({ initial = null }: { readonly initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial);

  return (
    <>
      <DurationField value={value} label="Duração" onChange={setValue} />
      <output>{value === null ? "vazio" : String(value)}</output>
    </>
  );
}

const field = () => screen.getByLabelText("Duração");
const seconds = () => screen.getByRole("status").textContent;

describe("typing a duration in minutes", () => {
  it("stores 40 min as 2400 seconds", async () => {
    render(<Harness />);

    await userEvent.type(field(), "40");

    expect(field()).toHaveValue("40");
    expect(seconds()).toBe("2400");
  });

  it("keeps the comma on screen while it is typed", async () => {
    render(<Harness />);

    await userEvent.type(field(), "12,");

    expect(field()).toHaveValue("12,");
  });

  it("reaches 12,5 min rather than losing the comma to a re-render", async () => {
    render(<Harness />);

    await userEvent.type(field(), "12,5");

    expect(field()).toHaveValue("12,5");
    expect(seconds()).toBe("750");
  });

  it("accepts a dot too", async () => {
    render(<Harness />);

    await userEvent.type(field(), "12.5");

    expect(seconds()).toBe("750");
  });

  it("never lets a minus sign land in the field", async () => {
    render(<Harness />);

    await userEvent.type(field(), "-40");

    expect(field()).toHaveValue("40");
    expect(seconds()).toBe("2400");
  });
});

describe("showing a stored duration", () => {
  it("shows 2400 seconds as 40", () => {
    render(<Harness initial={2400} />);

    expect(field()).toHaveValue("40");
  });

  it("shows a fractional minute with a comma", () => {
    render(<Harness initial={750} />);

    expect(field()).toHaveValue("12,5");
  });

  it("is empty rather than showing a zero nobody entered", () => {
    render(<Harness />);

    expect(field()).toHaveValue("");
  });
});

describe("clearing the field", () => {
  it("reports null rather than zero", async () => {
    render(<Harness initial={2400} />);

    await userEvent.clear(field());

    expect(seconds()).toBe("vazio");
  });
});

describe("the label", () => {
  it("names the field for assistive technology", () => {
    render(
      <DurationField
        value={null}
        label="Duração da série 1 de Esteira, em minutos"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText("Duração da série 1 de Esteira, em minutos"),
    ).toBeInTheDocument();
  });
});
