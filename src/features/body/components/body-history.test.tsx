import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_MEASUREMENTS } from "../services/body-log";
import type { BodyEntry } from "../types/body-entry";
import { BodyHistory } from "./body-history";

function entry(overrides: Partial<BodyEntry> & { id: string }): BodyEntry {
  return {
    day: overrides.id,
    weightKg: 80,
    bodyFatPercent: null,
    measurements: EMPTY_MEASUREMENTS,
    notes: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("Delete/Collapse — removing a measurement shrinks before it goes", () => {
  it("does not remove on confirmation alone — only once the row finishes shrinking", async () => {
    const onRemove = vi.fn();
    render(
      <BodyHistory
        entries={[entry({ id: "2026-08-01" })]}
        onEdit={vi.fn()}
        onRemove={onRemove}
      />,
    );

    const label = "Excluir a medição de 01/08/2026";
    await userEvent.click(screen.getByRole("button", { name: label }));
    await userEvent.click(
      screen.getByRole("button", { name: `Excluir?: ${label}` }),
    );
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.transitionEnd(
      screen
        .getByRole("button", { name: "Editar 01/08/2026" })
        .closest("li")!,
      { propertyName: "grid-template-rows" },
    );
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("2026-08-01");
  });
});
