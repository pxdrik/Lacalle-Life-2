import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MACRO_SPLIT_PRESETS } from "@/core/nutrition";

import { MacroSplitDialog } from "./macro-split-dialog";

describe("MacroSplitDialog", () => {
  it("picks a preset and commits it immediately", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const preset = MACRO_SPLIT_PRESETS[0]!;

    render(
      <MacroSplitDialog
        open
        onClose={onClose}
        current={undefined}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByText(preset.label));

    expect(onSelect).toHaveBeenCalledWith({
      proteinPercent: preset.proteinPercent,
      carbsPercent: preset.carbsPercent,
      fatPercent: preset.fatPercent,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("resets to automatic — no split stored", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <MacroSplitDialog
        open
        onClose={() => {}}
        current={{ proteinPercent: 40, carbsPercent: 30, fatPercent: 30 }}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByText("Automático"));

    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it("keeps custom save disabled until the three percentages sum to 100", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <MacroSplitDialog
        open
        onClose={() => {}}
        current={undefined}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByText("Personalizado"));
    await user.type(screen.getByLabelText(/Prot/), "40");
    await user.type(screen.getByLabelText(/Carb/), "30");
    await user.type(screen.getByLabelText(/Gord/), "20");

    expect(screen.getByText("Salvar")).toBeDisabled();
    expect(screen.getByText(/Faltam/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Gord/));
    await user.type(screen.getByLabelText(/Gord/), "30");

    expect(screen.getByText("Salvar")).toBeEnabled();
    await user.click(screen.getByText("Salvar"));

    expect(onSelect).toHaveBeenCalledWith({
      proteinPercent: 40,
      carbsPercent: 30,
      fatPercent: 30,
    });
  });

  it("shows a mini donut next to every preset, none for Automático", () => {
    render(
      <MacroSplitDialog
        open
        onClose={() => {}}
        current={undefined}
        onSelect={() => {}}
      />,
    );

    const automaticRow = screen.getByText("Automático").closest("button")!;
    expect(automaticRow.querySelector("svg")).not.toBeInTheDocument();

    for (const preset of MACRO_SPLIT_PRESETS) {
      const row = screen.getByText(preset.label).closest("button")!;
      expect(row.querySelector("svg")).toBeInTheDocument();
    }
  });

  it("shows a live preview donut once all three custom percentages are filled in", async () => {
    const user = userEvent.setup();

    render(
      <MacroSplitDialog
        open
        onClose={() => {}}
        current={undefined}
        onSelect={() => {}}
      />,
    );

    await user.click(screen.getByText("Personalizado"));
    // One donut per preset, plus the dialog's own close-icon svg.
    const baseline = document.querySelectorAll("svg").length;

    await user.type(screen.getByLabelText(/Prot/), "40");
    await user.type(screen.getByLabelText(/Carb/), "30");
    await user.type(screen.getByLabelText(/Gord/), "30");

    expect(document.querySelectorAll("svg")).toHaveLength(baseline + 1);
  });
});
