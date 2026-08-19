import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TimeField } from "./time-field";

/**
 * A 24-hour field typed by hand, replacing `<input type="time">` — the
 * native picker renders AM/PM on an English-locale OS regardless of the
 * page's `lang`, which is what the auditoria externa de 19/08 (BUG-003)
 * caught: "08:00 AM" beside a screen that otherwise never shows AM/PM.
 */

function Harness({ initial = null }: { readonly initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial);

  return (
    <>
      <TimeField value={value} label="Horário" onChange={setValue} />
      <output>{value ?? "vazio"}</output>
    </>
  );
}

const field = () => screen.getByLabelText("Horário");
const committed = () => screen.getByRole("status").textContent;

describe("typing a time", () => {
  it("inserts the colon after the hour as digits land", async () => {
    render(<Harness />);

    await userEvent.type(field(), "0830");

    expect(field()).toHaveValue("08:30");
    expect(committed()).toBe("08:30");
  });

  it("never shows AM/PM — there is no such state to render", async () => {
    render(<Harness />);

    await userEvent.type(field(), "2130");

    expect(field()).toHaveValue("21:30");
    expect(committed()).toBe("21:30");
  });
});

describe("on blur", () => {
  it("pads a half-typed hour into a full HH:mm", async () => {
    render(<Harness />);

    await userEvent.type(field(), "9");
    await userEvent.tab();

    expect(field()).toHaveValue("09:00");
    expect(committed()).toBe("09:00");
  });

  it("clamps an impossible hour or minute instead of storing garbage", async () => {
    render(<Harness />);

    await userEvent.type(field(), "9999");
    await userEvent.tab();

    expect(field()).toHaveValue("23:59");
  });
});

describe("clearing the field", () => {
  it("reports null rather than an empty string", async () => {
    render(<Harness initial="08:00" />);

    await userEvent.clear(field());
    await userEvent.tab();

    expect(committed()).toBe("vazio");
  });
});

describe("when the value changes from outside", () => {
  it("shows the new time", async () => {
    function Stepper() {
      const [value, setValue] = useState<string | null>("08:00");
      return (
        <>
          <TimeField value={value} label="Horário" onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue("19:45");
            }}
          >
            Jantar
          </button>
        </>
      );
    }

    render(<Stepper />);
    await userEvent.click(screen.getByRole("button", { name: "Jantar" }));

    expect(field()).toHaveValue("19:45");
  });
});

describe("the label", () => {
  it("names the field for assistive technology", () => {
    render(
      <TimeField value={null} label="Horário do Almoço" onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText("Horário do Almoço")).toBeInTheDocument();
  });
});
