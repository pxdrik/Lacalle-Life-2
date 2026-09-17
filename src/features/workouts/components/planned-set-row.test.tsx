import { fireEvent, render, screen } from "@testing-library/react";
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

describe("Delete/Collapse — removing a set shrinks before it goes", () => {
  it("does not remove on the tap itself — only once the row finishes shrinking", async () => {
    const onRemove = vi.fn();
    render(
      <ul>
        <PlannedSetRow
          set={set()}
          index={0}
          exerciseName="Esteira"
          isCardio={false}
          onChange={vi.fn()}
          onRemove={onRemove}
        />
      </ul>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Remover série 1 de Esteira" }),
    );
    expect(onRemove).not.toHaveBeenCalled();

    const li = screen.getByText("1").closest("li")!;
    fireEvent.transitionEnd(li, { propertyName: "grid-template-rows" });
    expect(onRemove).toHaveBeenCalledTimes(1);
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

  it("has no RPE selector, which rates effort against a target it has none of", () => {
    mount(set(), true);

    expect(
      screen.queryByLabelText("RPE alvo da série 1 de Esteira"),
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
