import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Macros } from "@/core/domain/macros";

import { MacroProgress } from "./macro-progress";

const TOTALS: Macros = { kcal: 1450, proteinG: 61.2, carbsG: 187.6, fatG: 48.7 };
const TARGETS: Macros = { kcal: 1930, proteinG: 176, carbsG: 185, fatG: 54 };

/**
 * Achado real (23/09/2026): "diferenciar a kcal do dia e dos alimentos" —
 * sem destaque nenhum, o total do dia lia do mesmo tamanho que Prot/Carb/
 * Gord ao lado dele.
 */
describe("MacroProgress — kcal se destaca das três metas ao lado", () => {
  it("centraliza e aumenta só a figura de kcal", () => {
    render(<MacroProgress totals={TOTALS} targets={TARGETS} />);

    const kcalRow = screen.getByText("1.450").parentElement;
    const proteinRow = screen.getByText("61,2").parentElement;

    expect(kcalRow?.className).toContain("text-xl");
    expect(kcalRow?.className).toContain("justify-center");
    expect(proteinRow?.className).not.toContain("text-xl");
    expect(proteinRow?.className).not.toContain("justify-center");
  });

  it("não muda nada quando kcal está fora da lista de figuras", () => {
    render(
      <MacroProgress
        totals={TOTALS}
        targets={TARGETS}
        figures={["proteinG", "carbsG", "fatG"]}
      />,
    );

    expect(screen.queryByText("1.450")).not.toBeInTheDocument();
    expect(screen.getByText("61,2").className).not.toContain("text-xl");
  });
});
