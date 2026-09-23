import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReorderSheet } from "./reorder-sheet";

const ITEMS = [
  { id: "a", label: "Café da manhã" },
  { id: "b", label: "Almoço", detail: "3 alimentos" },
];

describe("ReorderSheet", () => {
  it("lists every item with a drag handle, and its detail when given", () => {
    render(
      <ReorderSheet
        open
        title="Reordenar refeições"
        items={ITEMS}
        onReorder={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Reordenar refeições" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reordenar Café da manhã" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reordenar Almoço" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 alimentos")).toBeInTheDocument();
  });

  it("shows an empty state instead of a bare list when there is nothing to reorder", () => {
    render(
      <ReorderSheet
        open
        title="Reordenar alimentos"
        items={[]}
        onReorder={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Nada para reordenar.")).toBeInTheDocument();
  });

  it("closes via the dialog's own close button", async () => {
    const onClose = vi.fn();
    render(
      <ReorderSheet
        open
        title="Reordenar refeições"
        items={ITEMS}
        onReorder={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
