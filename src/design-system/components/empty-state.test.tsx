import { render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the required title and icon, with no caption or action", () => {
    render(<EmptyState icon={Plus} title="Nenhum registro ainda." />);

    expect(screen.getByText("Nenhum registro ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the caption when given one", () => {
    render(
      <EmptyState
        icon={Plus}
        title="Nenhuma medição ainda."
        caption="As medidas são opcionais."
      />,
    );

    expect(screen.getByText("As medidas são opcionais.")).toBeInTheDocument();
  });

  it("renders the action and fires its onClick, with the action's own icon", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Plus}
        title="Nenhuma medição ainda."
        action={{ label: "Registrar peso", onClick, icon: Plus }}
      />,
    );

    const button = screen.getByRole("button", { name: "Registrar peso" });
    button.click();

    expect(onClick).toHaveBeenCalledOnce();
  });
});
