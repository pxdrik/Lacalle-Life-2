import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "./tabs";

const ITEMS = [
  { id: "geral", label: "Geral" },
  { id: "calendario", label: "Calendário" },
  { id: "metas", label: "Metas" },
];

describe("Tabs", () => {
  it("exposes the tablist/tab contract, with only the active tab reachable by Tab", () => {
    render(
      <Tabs items={ITEMS} value="geral" onChange={vi.fn()} idPrefix="p" />,
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);

    const active = screen.getByRole("tab", { name: "Geral" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active).toHaveAttribute("tabIndex", "0");
    expect(active).toHaveAttribute("aria-controls", "p-panel-geral");

    const inactive = screen.getByRole("tab", { name: "Calendário" });
    expect(inactive).toHaveAttribute("aria-selected", "false");
    expect(inactive).toHaveAttribute("tabIndex", "-1");
  });

  it("calls onChange on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tabs items={ITEMS} value="geral" onChange={onChange} idPrefix="p" />,
    );

    await user.click(screen.getByRole("tab", { name: "Metas" }));

    expect(onChange).toHaveBeenCalledWith("metas");
  });

  it("moves selection with the arrow keys — roving tabindex, not plain Tab", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tabs items={ITEMS} value="geral" onChange={onChange} idPrefix="p" />,
    );

    screen.getByRole("tab", { name: "Geral" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("calendario");

    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("metas");

    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("geral");
  });
});
