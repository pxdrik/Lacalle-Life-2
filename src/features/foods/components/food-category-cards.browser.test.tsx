import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  hitTargetsAcross,
  setDensity,
  setViewport,
} from "@/test/geometry";

import { FoodRepositoryProvider } from "../data/food-repository-context";
import type { FoodRepository } from "../data/food-repository";
import { FOOD_CATEGORIES, type Food } from "../types/food";
import { FoodPicker } from "./food-picker";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/**
 * Roadmap 10.5 (30/09/2026): as categorias de alimento em cartões, no
 * seletor do Diário como o app o usa (sem moldura, na margem da página; a
 * tela Alimentos tem a mesma largura). "Carboidratos" é o nome mais longo e
 * o motivo da grade de 3 que cai para 2: medido, em 4 colunas ele não cabia
 * já em 360px. A régua mede a largura real do texto, com casas decimais,
 * porque a de inteiros deixou passar "Ombr…" nos exercícios (10.1).
 */
function food(category: Food["category"]): Food {
  return {
    id: category,
    name: `Alimento ${category}`,
    category,
    unit: "g",
    per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
    isCustom: false,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

function mount() {
  const repository: FoodRepository = {
    listAll: vi.fn().mockResolvedValue(FOOD_CATEGORIES.map(food)),
    getById: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    remove: vi.fn(),
    isEmpty: vi.fn().mockResolvedValue(false),
  };
  render(
    <main className="px-4">
      <FoodRepositoryProvider repository={Promise.resolve(repository)}>
        <FoodPicker chrome={false} onPick={vi.fn()} onCancel={vi.fn()} />
      </FoodRepositoryProvider>
    </main>,
  );
}

function textWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}

describe("10.5 — categorias de alimento em cartões", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount();

        // A linha da busca (02/10/2026): campo, Categorias, estrela e fechar
        // cabem lado a lado, cada um tocável onde aparece.
        const toggle = await screen.findByRole("button", { name: "Categorias" });
        const row = toggle.parentElement!;
        const controls = [...row.children] as HTMLElement[];
        for (let i = 1; i < controls.length; i++) {
          expect(controls[i]!.getBoundingClientRect().left, "controles da busca encavalados").toBeGreaterThanOrEqual(controls[i - 1]!.getBoundingClientRect().right - 0.5);
        }
        expect(controls.at(-1)!.getBoundingClientRect().right, "a busca passa da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        for (const control of controls.slice(1)) {
          for (const hit of hitTargetsAcross(control)) expect(control.contains(hit), "toque fora do botão").toBe(true);
        }

        await userEvent.click(toggle);
        const grid = await screen.findByRole("group", { name: "Categorias" });
        await waitFor(() => {
          expect(within(grid).getByRole("button", { name: /^Todos/ })).toHaveTextContent("7");
        });
        expect(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          "a página rola de lado",
        ).toBeLessThanOrEqual(0);

        const cards = within(grid).getAllByRole("button");
        expect(cards).toHaveLength(8);
        for (const card of cards) {
          const name = card.querySelector("span")!;
          expect(textWidth(name), `"${name.textContent ?? ""}" cortado`).toBeLessThanOrEqual(
            name.getBoundingClientRect().width,
          );
          expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(grid.getBoundingClientRect().right + 0.5);
          for (const hit of hitTargetsAcross(card)) {
            expect(card.contains(hit), `toque em ${name.textContent ?? ""}`).toBe(true);
          }
        }
        cleanup();
      });
    }
  }
});
