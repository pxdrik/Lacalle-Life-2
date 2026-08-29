import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PerformedSet } from "../types/session";
import { PerformedSetRow } from "./performed-set-row";

/**
 * The quick steppers on the set being done.
 *
 * Typing a load one-handed, standing, between sets is the slowest interaction
 * in the app, and the one performed in the worst conditions. These buttons
 * exist so the common case — same movement, one plate more — never opens a
 * keyboard.
 */

function set(overrides: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: "s1",
    reps: 10,
    weightKg: 60,
    rpe: null,
    durationSeconds: null,
    isCompleted: false,
    planned: null,
    ...overrides,
  };
}

function mount(value: PerformedSet, isNext = true, isCardio = false) {
  const onChange = vi.fn();

  render(
    <ul>
      <PerformedSetRow
        set={value}
        index={0}
        exerciseName="Supino"
        isNext={isNext}
        isCardio={isCardio}
        onChange={onChange}
        onToggleComplete={vi.fn()}
        onRemove={vi.fn()}
      />
    </ul>,
  );

  return onChange;
}

const tap = (name: RegExp) =>
  userEvent.click(screen.getByRole("button", { name }));

/**
 * The confirmation on a finished set belongs to the tap, not to the state.
 *
 * Keyed off `isCompleted` it would have fired on mount, so reopening a workout
 * with twenty-four finished sets would set twenty-four checks bouncing at once
 * — which is the difference between an app that acknowledges you and one that
 * congratulates you for scrolling.
 */
describe("marking a set as done", () => {
  // Anchored, because "Remover série 1 de Supino" also contains "série 1".
  const TOGGLE = /^Desmarcar série 1/;
  const check = () =>
    screen.getByRole("button", { name: TOGGLE }).querySelector("svg");

  it("stays still when a set arrives already completed", () => {
    mount(set({ isCompleted: true }));

    expect(check()).not.toHaveClass("animate-pop");
  });

  it("confirms the set the moment it is tapped", async () => {
    // `onToggleComplete` belongs to the parent, so this row never sees
    // `isCompleted` flip on its own — mounting it completed and tapping puts
    // the component in the state the real screen puts it in.
    mount(set({ isCompleted: true }));
    await tap(TOGGLE);

    expect(check()).toHaveClass("animate-pop");
  });
});

describe("Iniciativa D — a finished set reads at a glance", () => {
  function row() {
    // The `<li>` itself carries the surface/border — walk up from a stable
    // child rather than relying on a container query that could match the
    // wrong element.
    return screen.getByText("1").closest("li");
  }

  it("gives a finished set a filled, bordered surface", () => {
    mount(set({ isCompleted: true }), false);

    expect(row()).toHaveClass("bg-muted", "border-line");
  });

  it("never dims the row with opacity — that used to fade the check itself", () => {
    mount(set({ isCompleted: true }), false);

    expect(row()).not.toHaveClass("opacity-60");
  });

  it("leaves an unfinished, non-next set with no surface at all", () => {
    mount(set({ isCompleted: false }), false);

    expect(row()).not.toHaveClass("bg-muted");
    expect(row()).not.toHaveClass("border-line");
  });
});

describe("stepping the load", () => {
  it("adds a pair of the smallest plates", async () => {
    const onChange = mount(set({ weightKg: 60 }));

    await tap(/^Mais 2,5 kg/);

    expect(onChange).toHaveBeenCalledWith({ weightKg: 62.5 });
  });

  it("does not drift into binary floating point", async () => {
    // 62.5 + 2.5 is exact, but the general case is not, and a field reading
    // 62.50000000000001 is how people stop trusting the number.
    const onChange = mount(set({ weightKg: 0.1 }));

    await tap(/^Mais 2,5 kg/);

    expect(onChange).toHaveBeenCalledWith({ weightKg: 2.6 });
  });

  it("never goes negative, because a load cannot", async () => {
    const onChange = mount(set({ weightKg: 1 }));

    await tap(/^Menos 2,5 kg/);

    expect(onChange).toHaveBeenCalledWith({ weightKg: 0 });
  });

  it("starts from what was planned when the field is empty", async () => {
    // Pressing +2,5 on an empty field for a machine you always load to 60
    // should land near 60, not at 2,5.
    const onChange = mount(
      set({
        weightKg: null,
        planned: { reps: null, weightKg: 60, rpe: null, durationSeconds: null },
      }),
    );

    await tap(/^Mais 2,5 kg/);

    expect(onChange).toHaveBeenCalledWith({ weightKg: 62.5 });
  });
});

describe("stepping the repetitions", () => {
  it("moves one at a time", async () => {
    const onChange = mount(set({ reps: 10 }));

    await tap(/^Mais uma repetição/);

    expect(onChange).toHaveBeenCalledWith({ reps: 11 });
  });

  it("stops at zero", async () => {
    const onChange = mount(set({ reps: 0 }));

    await tap(/^Menos uma repetição/);

    expect(onChange).toHaveBeenCalledWith({ reps: 0 });
  });
});

describe("where the steppers appear", () => {
  it("only on the set being done", async () => {
    mount(set(), false);

    expect(
      screen.queryByRole("button", { name: /^Mais 2,5 kg/ }),
    ).not.toBeInTheDocument();
  });

  it("not on a set already finished, which nobody is adjusting", async () => {
    mount(set({ isCompleted: true }), true);

    expect(
      screen.queryByRole("button", { name: /^Mais 2,5 kg/ }),
    ).not.toBeInTheDocument();
  });
});

describe("a cardio exercise", () => {
  it("shows a duration field instead of reps and weight", () => {
    mount(set({ reps: null, weightKg: null, durationSeconds: 2400 }), true, true);

    expect(
      screen.getByLabelText("Duração da série 1 de Supino, em minutos"),
    ).toHaveValue("40");
    expect(
      screen.queryByLabelText("Repetições da série 1 de Supino"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Peso da série 1 de Supino"),
    ).not.toBeInTheDocument();
  });

  it("writes the typed minutes to durationSeconds through onChange", async () => {
    const onChange = mount(set({ durationSeconds: null }), true, true);
    const field = screen.getByLabelText(
      "Duração da série 1 de Supino, em minutos",
    );

    await userEvent.type(field, "40");

    expect(onChange).toHaveBeenLastCalledWith({ durationSeconds: 2400 });
  });

  it("has no RPE selector, which rates effort against a target it has none of", () => {
    mount(set({ durationSeconds: null }), true, true);

    expect(
      screen.queryByLabelText("RPE da série 1 de Supino"),
    ).not.toBeInTheDocument();
  });

  it("has no rep/weight steppers, which have no cardio equivalent", () => {
    mount(set({ durationSeconds: null }), true, true);

    expect(
      screen.queryByRole("button", { name: /^Mais uma repetição/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Mais 2,5 kg/ }),
    ).not.toBeInTheDocument();
  });

  it("a non-cardio exercise still shows reps and weight as before", () => {
    mount(set(), true, false);

    expect(
      screen.getByLabelText("Repetições da série 1 de Supino"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Duração da série 1 de Supino, em minutos"),
    ).not.toBeInTheDocument();
  });
});
