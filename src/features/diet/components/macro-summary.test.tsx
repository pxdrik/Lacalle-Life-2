import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Macros } from "@/core/domain/macros";

import { MacroSummary } from "./macro-summary";

const MACROS: Macros = { kcal: 192, proteinG: 7, carbsG: 32.3, fatG: 3.5 };

function dl() {
  return screen.getByText("192").closest("dl");
}

/**
 * Achado real (23/09/2026): a primeira tentativa de destacar o total da
 * refeição em `meal-card.tsx` centralizava o bloco todo por fora
 * (`<div className="flex justify-center">` embrulhando `MacroSummary`) —
 * quando as quatro figuras não cabiam numa linha só, a segunda linha
 * ("3,5 Gord" sozinho) ficava pregada na borda esquerda, porque
 * `justify-content` só existe por dentro de quem quebra a linha. `center`
 * fica no próprio `dl`, que é quem tem `flex-wrap` — assim cada linha
 * quebrada centraliza sozinha, não só o bloco como unidade.
 */
describe("MacroSummary — center", () => {
  it("põe justify-center no próprio dl, não num wrapper por fora", () => {
    render(<MacroSummary macros={MACROS} center />);

    expect(dl()?.className).toContain("justify-center");
  });

  it("sem center, nenhum justify-center aparece", () => {
    render(<MacroSummary macros={MACROS} />);

    expect(dl()?.className).not.toContain("justify-center");
  });

  it("size='lg' aumenta as quatro figuras juntas — kcal e as três macros", () => {
    render(<MacroSummary macros={MACROS} size="lg" />);

    expect(screen.getByText("192").className).toContain("text-xl");
    expect(screen.getByText("7").className).toContain("text-xl");
    expect(screen.getByText("32,3").className).toContain("text-xl");
    expect(screen.getByText("3,5").className).toContain("text-xl");
  });

  it("tamanho padrão continua pequeno para as quatro", () => {
    render(<MacroSummary macros={MACROS} />);

    expect(screen.getByText("192").className).toContain("text-sm");
    expect(screen.getByText("7").className).toContain("text-sm");
  });
});
