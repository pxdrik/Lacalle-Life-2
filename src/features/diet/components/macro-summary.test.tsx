import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Macros } from "@/core/domain/macros";

import { MacroSummary } from "./macro-summary";

const MACROS: Macros = { kcal: 192, proteinG: 7, carbsG: 32.3, fatG: 3.5 };

function dl() {
  return screen.getByText("192").closest("dl");
}

/**
 * Achado real (23/09/2026), com print de referência do Pedro: o total da
 * refeição precisa ler maior que o de cada alimento embaixo dele — as
 * quatro figuras juntas, sempre numa linha só, nunca quebrando. Duas
 * tentativas com `layout="inline"` (`size="lg"`, depois tentando
 * `justify-center` no `dl`) não davam conta: quatro pares "valor unidade"
 * lado a lado não cabem na largura de um card de celular, e uma vez que
 * quebra, nada centraliza a segunda linha sozinha. `"stacked"` evita o
 * problema em vez de tentar consertar o wrap: cada coluna só precisa da
 * largura do maior entre o valor e o rótulo curto, nunca da soma dos dois.
 */
describe("MacroSummary — layout='stacked'", () => {
  it("cada figura vira uma coluna, valor em cima do rótulo", () => {
    render(<MacroSummary macros={MACROS} layout="stacked" />);

    const kcalValue = screen.getByText("192");
    const kcalLabel = screen.getByText("kcal");
    // Ambos filhos diretos da mesma coluna, valor primeiro no DOM — dd/dt
    // são block-level por padrão, então a ordem no DOM já é a ordem visual
    // de cima pra baixo, sem precisar de flex-col.
    expect(kcalValue.parentElement).toBe(kcalLabel.parentElement);
    expect(kcalValue.compareDocumentPosition(kcalLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("as quatro figuras ficam grandes juntas, kcal e as três macros", () => {
    render(<MacroSummary macros={MACROS} layout="stacked" />);

    expect(screen.getByText("192").className).toContain("text-xl");
    expect(screen.getByText("7").className).toContain("text-xl");
    expect(screen.getByText("32,3").className).toContain("text-xl");
    expect(screen.getByText("3,5").className).toContain("text-xl");
  });

  it("o dl vira um grid de 4 colunas — nunca quebra linha", () => {
    render(<MacroSummary macros={MACROS} layout="stacked" />);

    expect(dl()?.className).toContain("grid-cols-4");
    expect(dl()?.className).not.toContain("flex-wrap");
  });
});

describe("MacroSummary — layout padrão ('inline'), sem mudança", () => {
  it("size='lg' aumenta as quatro figuras juntas", () => {
    render(<MacroSummary macros={MACROS} size="lg" />);

    expect(screen.getByText("192").className).toContain("text-xl");
    expect(screen.getByText("7").className).toContain("text-xl");
  });

  it("tamanho padrão continua pequeno", () => {
    render(<MacroSummary macros={MACROS} />);

    expect(screen.getByText("192").className).toContain("text-sm");
  });
});
