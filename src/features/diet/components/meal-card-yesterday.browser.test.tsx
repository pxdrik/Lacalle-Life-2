import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  setDensity,
  setViewport,
} from "@/test/geometry";

import { createMeal } from "../services/create-diet";
import { MealCard } from "./meal-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/**
 * Roadmap 7.3 (30/09/2026): a faixa "Igual a ontem?" cabe na refeição em
 * toda largura e densidade. A primeira versão cortava o título em 320px na
 * densidade Confortável ("Igual a"), e escondia as kcal no fim do resumo.
 */
describe("7.3 — a faixa \"Igual a ontem?\" cabe", () => {
  const meal = { ...createMeal(1), name: "Almoço", time: "12:30", items: [] };
  const noop = vi.fn();

  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width);
        setDensity(density);
        const { getByText, getByRole } = render(
          <main className="px-4 py-4">
            <MealCard
              meal={meal}
              position={0}
              total={1}
              onChange={noop}
              onRemove={noop}
              onDuplicate={noop}
              onMove={noop}
              onAddFoodClick={noop}
              onItemGramsChange={noop}
              onRemoveItem={noop}
              onReorderItems={noop}
              otherMeals={[]}
              onSendItem={noop}
              fromYesterday={{
                summary: "Arroz branco cozido, Feijão carioca, Peito de frango grelhado",
                kcal: 612,
                onCopy: noop,
              }}
            />
          </main>,
        );

        const title = getByText("Igual a ontem?");
        // Título inteiro, numa linha: sem corte horizontal.
        expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1);
        // O botão não passa da faixa.
        const banner = title.closest(".bg-muted")!.getBoundingClientRect();
        const button = getByRole("button", { name: "Copiar Almoço de ontem" }).getBoundingClientRect();
        expect(button.right).toBeLessThanOrEqual(banner.right + 0.5);
        // As kcal abrem o resumo, então aparecem mesmo com corte.
        expect(getByText(/^612 kcal · /)).toBeInTheDocument();
      });
    }
  }
});
