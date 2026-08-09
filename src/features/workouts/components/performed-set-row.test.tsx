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
    isCompleted: false,
    planned: null,
    ...overrides,
  };
}

function mount(value: PerformedSet, isNext = true) {
  const onChange = vi.fn();

  render(
    <ul>
      <PerformedSetRow
        set={value}
        index={0}
        exerciseName="Supino"
        isNext={isNext}
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
      set({ weightKg: null, planned: { reps: null, weightKg: 60, rpe: null } }),
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

    expect(screen.queryByRole("button", { name: /^Mais 2,5 kg/ })).not.toBeInTheDocument();
  });

  it("not on a set already finished, which nobody is adjusting", async () => {
    mount(set({ isCompleted: true }), true);

    expect(screen.queryByRole("button", { name: /^Mais 2,5 kg/ })).not.toBeInTheDocument();
  });
});
