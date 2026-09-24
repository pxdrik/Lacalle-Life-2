import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Macros } from "@/core/domain/macros";

import { MacroSummary } from "./macro-summary";

const MACROS: Macros = { kcal: 192, proteinG: 7, carbsG: 32.3, fatG: 3.5 };

/**
 * Achado real (23/09/2026): a primeira tentativa de destacar o total da
 * refeição usou `size="lg"` nas quatro figuras — quebrava a linha num
 * celular ("3,5 Gord" sozinho embaixo) e não sobrava nada pra centralizar
 * de verdade. `emphasizeKcal` só aumenta kcal; Prot/Carb/Gord continuam do
 * tamanho normal, então a linha inteira cabe numa linha só.
 */
describe("MacroSummary — emphasizeKcal", () => {
  it("aumenta só kcal, mantendo Prot/Carb/Gord no tamanho normal", () => {
    render(<MacroSummary macros={MACROS} emphasizeKcal />);

    expect(screen.getByText("192").className).toContain("text-xl");
    expect(screen.getByText("7").className).not.toContain("text-xl");
    expect(screen.getByText("32,3").className).not.toContain("text-xl");
    expect(screen.getByText("3,5").className).not.toContain("text-xl");
  });

  it("sem emphasizeKcal, kcal fica do mesmo tamanho que os outros três", () => {
    render(<MacroSummary macros={MACROS} />);

    expect(screen.getByText("192").className).toContain("text-sm");
    expect(screen.getByText("192").className).not.toContain("text-xl");
  });

  it("size='lg' continua aumentando as quatro figuras, sem emphasizeKcal", () => {
    render(<MacroSummary macros={MACROS} size="lg" />);

    expect(screen.getByText("192").className).toContain("text-xl");
    expect(screen.getByText("7").className).toContain("text-xl");
  });
});
