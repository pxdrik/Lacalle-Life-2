import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  hitTargetsAcross,
  overflowX,
  setDensity,
  setViewport,
} from "@/test/geometry";

import type { Meal, MealItem } from "../types/diet";
import { MealCard } from "./meal-card";

/**
 * O card de refeição do Diário, medido em pixels de tela.
 *
 * O achado B1 da auditoria é geométrico antes de ser semântico: planejado e
 * consumido eram o mesmo desenho, com o mesmo total na mesma tipografia. A
 * linha que passou a distingui-los é texto de largura variável ("Planejado ·
 * ainda não somado no total do dia") acrescentada a um card que já era
 * apertado a 320px — exatamente a forma de mudança que este projeto já viu
 * transbordar por cima da coluna vizinha. jsdom não veria nada disso.
 */

const PLANNED = /Planejado · ainda não somado/;

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: "i1",
    foodId: "abacate",
    name: "Abacate",
    grams: 100,
    unit: "g",
    per100g: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 },
    ...overrides,
  };
}

/** Um nome longo de verdade: é o que força a quebra, e o caso feliz nunca
 * encontrou um defeito de layout neste projeto. */
const LONG_NAME = "Almoço de domingo na casa da minha avó";

function meal(name: string, items: readonly MealItem[]): Meal {
  return { id: "m1", name, time: null, notes: "", items };
}

type CheckState = "unchecked" | "checked" | "edited";

function mount(theMeal: Meal, checkState?: CheckState) {
  render(
    <MealCard
      meal={theMeal}
      position={0}
      total={1}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      onDuplicate={vi.fn()}
      onMove={vi.fn()}
      onAddFoodClick={vi.fn()}
      onItemGramsChange={vi.fn()}
      onRemoveItem={vi.fn()}
      onReorderItems={vi.fn()}
      otherMeals={[]}
      onSendItem={vi.fn()}
      checkState={checkState}
      onToggleChecked={checkState === undefined ? undefined : vi.fn()}
    />,
  );
}

/**
 * Os estados que o brief da Sprint 2 pede, como fixtures — e nenhum deles
 * toca IndexedDB, schema, persistência ou domínio.
 */
const STATES = [
  { name: "planejado, sem consumo", check: "unchecked" as const },
  { name: "consumido", check: "checked" as const },
  { name: "consumido diferente do planejado", check: "edited" as const },
  { name: "montada à mão (sem check)", check: undefined },
];

describe("DIARY-01 — planejado se distingue de consumido", () => {
  it("dá ao card planejado uma linha que o consumido não tem", async () => {
    await setViewport(390, 800);
    mount(meal("Almoço", [item()]), "unchecked");

    const label = screen.getByText(PLANNED);

    // Não é só "existe no DOM": tem que estar desenhada, dentro do card, e
    // depois dos números que ela explica.
    const box = label.getBoundingClientRect();
    const totals = document.querySelector("dl")!.getBoundingClientRect();

    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.top).toBeGreaterThanOrEqual(totals.bottom - 1);
  });

  it("não desenha essa linha em nenhum outro estado", async () => {
    for (const state of STATES.filter((s) => s.check !== "unchecked")) {
      await setViewport(390, 800);
      mount(meal("Almoço", [item()]), state.check);

      expect(
        screen.queryByText(PLANNED),
        `estado "${state.name}" não deveria ser marcado`,
      ).not.toBeInTheDocument();

      cleanup();
    }
  });
});

describe("DIARY-04 e responsividade — a hierarquia aguenta o pior caso", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`cabe em ${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        // Nome longo + estado planejado: a combinação mais larga que o card
        // consegue produzir.
        mount(meal(LONG_NAME, [item()]), "unchecked");
        screen.getByText(PLANNED);

        const card = document.querySelector("section")!;

        expect(overflowX(card)).toBeLessThanOrEqual(0);
        expect(
          document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ).toBeLessThanOrEqual(0);
      });
    }
  }

  it("mantém o total da refeição acima da linha de estado, sem sobreposição", async () => {
    await setViewport(320, 900);
    setDensity("comfortable");
    mount(meal(LONG_NAME, [item()]), "unchecked");

    const totals = document.querySelector("dl")!.getBoundingClientRect();
    const label = screen.getByText(PLANNED).getBoundingClientRect();

    expect(label.top).toBeGreaterThanOrEqual(totals.bottom - 1);
  });
});

describe("DIARY-06 — registrar continua alcançável", () => {
  it("entrega o toque ao botão de marcar como comida em toda a sua largura", async () => {
    await setViewport(320, 900);
    mount(meal(LONG_NAME, [item()]), "unchecked");

    const check = screen.getByRole("button", {
      name: `Marcar ${LONG_NAME} como comida`,
    });

    // `touch-44` estende o alvo 44px para fora do layout; vizinhos sem
    // intervalo suficiente roubam o toque e vence o último do DOM. Foi assim
    // que ~19% da direita de cada ícone da barra de exercício disparava o
    // botão ao lado.
    for (const hit of hitTargetsAcross(check)) {
      expect(check.contains(hit)).toBe(true);
    }
  });

  it("mantém o botão de adicionar alimento visível e com área de toque", async () => {
    await setViewport(320, 900);
    setDensity("comfortable");
    mount(meal(LONG_NAME, [item()]), "unchecked");

    const add = screen.getByRole("button", { name: /Adicionar alimento/ });
    const box = add.getBoundingClientRect();

    expect(box.width).toBeGreaterThan(0);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(
      document.documentElement.clientWidth + 1,
    );
  });
});
