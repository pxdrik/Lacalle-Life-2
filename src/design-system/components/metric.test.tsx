import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Metric } from "./metric";

describe("Metric", () => {
  it("renders the value, unit and label", () => {
    render(<Metric value="2.759" unit="kcal" label="restantes hoje" />);

    expect(screen.getByText("2.759")).toBeInTheDocument();
    expect(screen.getByText("kcal")).toBeInTheDocument();
    expect(screen.getByText("restantes hoje")).toBeInTheDocument();
  });

  it("omits the unit node entirely when none is given", () => {
    const { container } = render(<Metric value="144" label="Proteína" />);

    // Only the value/label text nodes — nothing rendered for an absent unit.
    expect(container.textContent).toBe("144Proteína");
  });

  it("applies a tone to the value only, never to the label", () => {
    render(
      <Metric value="2.847" unit="kcal" label="acima da meta" tone="text-warning" />,
    );

    expect(screen.getByText("2.847")).toHaveClass("text-warning");
    expect(screen.getByText("acima da meta")).not.toHaveClass("text-warning");
  });

  it("centers the value row and text when align is 'center'", () => {
    render(<Metric value="144" unit="g" label="Prot" align="center" />);

    expect(screen.getByText("144").closest("div")).toHaveClass(
      "justify-center",
    );
  });
});

describe("Number Update — the value-change animation", () => {
  it("does not animate on the initial render", () => {
    render(<Metric value="1.840" label="kcal para hoje" />);

    expect(screen.getByText("1.840")).not.toHaveClass("animate-value-change");
  });

  it("animates when the value changes on a later render", () => {
    const { rerender } = render(<Metric value="1.840" label="kcal para hoje" />);

    rerender(<Metric value="1.965" label="kcal para hoje" />);

    expect(screen.getByText("1.965")).toHaveClass("animate-value-change");
  });

  it("does not animate again on a re-render with the same value", () => {
    const { rerender } = render(<Metric value="1.840" label="kcal para hoje" />);

    rerender(<Metric value="1.840" label="kcal para hoje" />);

    expect(screen.getByText("1.840")).not.toHaveClass("animate-value-change");
  });

  it("keeps its own tone after changing — the animation must not freeze the flash colour", () => {
    const { rerender } = render(
      <Metric value="60" unit="g" label="Prot" tone="text-protein-text" />,
    );

    rerender(<Metric value="65" unit="g" label="Prot" tone="text-protein-text" />);

    expect(screen.getByText("65")).toHaveClass("text-protein-text");
  });
});
