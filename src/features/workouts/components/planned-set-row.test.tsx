import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlannedSet } from "../types/routine";
import { PlannedSetRow } from "./planned-set-row";

function set(overrides: Partial<PlannedSet> = {}): PlannedSet {
  return {
    id: "s1",
    reps: 8,
    weightKg: 60,
    rpe: null,
    durationSeconds: null,
    ...overrides,
  };
}

function mount(value: PlannedSet, isCardio = false) {
  const onChange = vi.fn();

  render(
    <ul>
      <PlannedSetRow
        set={value}
        index={0}
        exerciseName="Esteira"
        isCardio={isCardio}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    </ul>,
  );

  return onChange;
}

describe("a strength exercise", () => {
  it("shows reps and weight fields", () => {
    mount(set());

    expect(
      screen.getByLabelText("Repetições da série 1 de Esteira"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Peso da série 1 de Esteira"),
    ).toBeInTheDocument();
  });
});

describe("a cardio exercise", () => {
  it("shows a single duration field instead", () => {
    mount(set({ durationSeconds: 2400 }), true);

    expect(
      screen.getByLabelText("Duração da série 1 de Esteira, em minutos"),
    ).toHaveValue("40");
    expect(
      screen.queryByLabelText("Repetições da série 1 de Esteira"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Peso da série 1 de Esteira"),
    ).not.toBeInTheDocument();
  });

  it("converts typed minutes to durationSeconds", async () => {
    const onChange = mount(set({ durationSeconds: null }), true);

    await userEvent.type(
      screen.getByLabelText("Duração da série 1 de Esteira, em minutos"),
      "40",
    );

    expect(onChange).toHaveBeenLastCalledWith({ durationSeconds: 2400 });
  });
});
