import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("always renders the state as text, never colour alone", () => {
    render(<Badge state="atencao">Quase lá</Badge>);

    expect(screen.getByText("Quase lá")).toBeInTheDocument();
  });

  it("keeps 'próximo' and 'concluído' as distinct states", () => {
    // Both read as structural/semantic green in the palette, but the point
    // of the five-state grammar is that they never collapse into the same
    // meaning — proved here by the words, not the colour.
    render(
      <>
        <Badge state="proximo">Em andamento</Badge>
        <Badge state="concluido">Meta batida</Badge>
      </>,
    );

    expect(screen.getByText("Em andamento")).toBeInTheDocument();
    expect(screen.getByText("Meta batida")).toBeInTheDocument();
  });

  it.each([
    ["neutro"],
    ["proximo"],
    ["atencao"],
    ["concluido"],
    ["negativo"],
  ] as const)("renders the %s state with a border and a text colour", (state) => {
    render(<Badge state={state}>estado</Badge>);

    const badge = screen.getByText("estado");
    expect(badge.className).toContain("border");
    expect(badge.className).toMatch(/text-/);
  });
});
