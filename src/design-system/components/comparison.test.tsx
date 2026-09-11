import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Comparison } from "./comparison";

const fmtKg = (n: number) => n.toFixed(1).replace(".", ",") + " kg";

describe("Comparison", () => {
  it("draws the up arrow and a + sign for a positive delta", () => {
    render(
      <Comparison delta={5.3} formatMagnitude={fmtKg} label="nos últimos 30 dias" />,
    );

    expect(screen.getByText("subiu:")).toHaveClass("sr-only");
    expect(screen.getByText(/\+5,3 kg nos últimos 30 dias/)).toBeInTheDocument();
  });

  it("draws the down arrow and a − sign for a negative delta", () => {
    render(
      <Comparison delta={-5.3} formatMagnitude={fmtKg} label="nos últimos 30 dias" />,
    );

    expect(screen.getByText("desceu:")).toHaveClass("sr-only");
    expect(screen.getByText(/−5,3 kg nos últimos 30 dias/)).toBeInTheDocument();
  });

  it("draws a dash and the zero caption when delta is exactly 0", () => {
    render(
      <Comparison
        delta={0}
        formatMagnitude={fmtKg}
        label="nos últimos 30 dias"
        whenZero="sem mudança"
      />,
    );

    expect(screen.getByText("estável:")).toHaveClass("sr-only");
    expect(screen.getByText(/sem mudança nos últimos 30 dias/)).toBeInTheDocument();
  });

  it("never infers tone from the sign — neutral by default even for a positive delta", () => {
    render(
      <Comparison delta={5.3} formatMagnitude={fmtKg} label="nos últimos 30 dias" />,
    );

    expect(screen.getByText(/\+5,3 kg/).closest("span")).toHaveClass(
      "text-ink-subtle",
    );
  });

  it("applies the tone the caller chose, independent of direction", () => {
    render(
      <Comparison
        delta={-1450}
        formatMagnitude={(n) => `R$ ${n}`}
        label="este mês"
        tone="negative"
      />,
    );

    expect(screen.getByText(/−R\$ 1450/).closest("span")).toHaveClass(
      "text-danger",
    );
  });
});
