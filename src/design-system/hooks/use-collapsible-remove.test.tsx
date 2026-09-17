import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useCollapsibleRemove } from "./use-collapsible-remove";

function Probe({ onRemove }: { readonly onRemove: () => void }) {
  const { collapsed, requestRemove, collapseProps } =
    useCollapsibleRemove(onRemove);

  return (
    <div data-testid="row" {...collapseProps}>
      <p>collapsed: {String(collapsed)}</p>
      <button type="button" onClick={requestRemove}>
        Remover
      </button>
    </div>
  );
}

describe("useCollapsibleRemove", () => {
  it("starts open, at the full track size", () => {
    render(<Probe onRemove={vi.fn()} />);

    expect(screen.getByTestId("row")).toHaveStyle({
      gridTemplateRows: "1fr",
    });
    expect(screen.getByText("collapsed: false")).toBeInTheDocument();
  });

  it("shrinks the track on request, without removing yet", async () => {
    const onRemove = vi.fn();
    render(<Probe onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(screen.getByTestId("row")).toHaveStyle({
      gridTemplateRows: "0fr",
    });
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("removes only once the grid-track transition itself ends", async () => {
    const onRemove = vi.fn();
    render(<Probe onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover" }));
    fireEvent.transitionEnd(screen.getByTestId("row"), {
      propertyName: "grid-template-rows",
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("ignores an unrelated property finishing on the same element", async () => {
    const onRemove = vi.fn();
    render(<Probe onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover" }));
    fireEvent.transitionEnd(screen.getByTestId("row"), {
      propertyName: "opacity",
    });

    expect(onRemove).not.toHaveBeenCalled();
  });

  it("ignores a transition ending before anyone asked to remove", () => {
    const onRemove = vi.fn();
    render(<Probe onRemove={onRemove} />);

    fireEvent.transitionEnd(screen.getByTestId("row"), {
      propertyName: "grid-template-rows",
    });

    expect(onRemove).not.toHaveBeenCalled();
  });
});
