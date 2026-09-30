import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import { createQuickItem } from "../services/quick-item";
import type { Meal, MealItem } from "../types/diet";
import { MealCard } from "./meal-card";

/**
 * Registro rápido (roadmap 7.7), medido. O rodapé da refeição ganhou um
 * terceiro controle ("Registro rápido") ao lado de "Adicionar alimento",
 * "Outras sugestões" e Observações, onde o 8.16 já achou aperto. A folha põe
 * três campos lado a lado. A linha do avulso troca o campo de gramas pela
 * etiqueta e mostra "—".
 */
const RICE: MealItem = {
  id: "arroz",
  foodId: "arroz",
  name: "Arroz",
  grams: 100,
  unit: "g",
  per100g: { kcal: 130, proteinG: 3, carbsG: 28, fatG: 0 },
};
const QUICK = createQuickItem({ name: "Almoço no restaurante", kcal: 850, proteinG: 40, carbsG: null, fatG: null });

function mount(theMeal: Meal) {
  render(
    <main className="px-4">
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
        onApplyAlternative={vi.fn()}
        onQuickLog={vi.fn()}
        onEditQuickItem={vi.fn()}
      />
    </main>,
  );
}

function pageOverflow(): number {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth;
}

describe("7.7 — registro rápido", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount({ id: "m1", name: "Almoço", time: null, notes: "", items: [RICE, QUICK] });

        const card = screen.getByRole("button", { name: "Registro rápido" }).closest("section")!;
        expect(pageOverflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        expect(overflowX(card)).toBeLessThanOrEqual(0);

        // O rodapé: cada controle inteiro e tocável onde está desenhado.
        const notes = screen.getByRole("textbox", { name: "Observações de Almoço" });
        expect(overflowX(notes), "Observações cortado").toBeLessThanOrEqual(0);
        for (const name of ["Adicionar alimento", "Registro rápido", "Outras sugestões"]) {
          const control = screen.getByRole("button", { name: new RegExp(`^${name}`) });
          for (const hit of hitTargetsAcross(control)) {
            expect(control.contains(hit), `toque em ${name}`).toBe(true);
          }
        }

        // A linha do avulso e a nota do total cabem no card.
        const row = screen.getByRole("button", { name: "Editar Almoço no restaurante" }).closest("li")!;
        expect(overflowX(row)).toBeLessThanOrEqual(0);
        const note = screen.getByText(/Sem o carboidrato e a gordura/);
        expect(note.getBoundingClientRect().right).toBeLessThanOrEqual(card.getBoundingClientRect().right + 0.5);

        // A folha: três campos lado a lado, sem rolar de lado.
        await userEvent.click(screen.getByRole("button", { name: "Registro rápido" }));
        const sheet = screen.getByRole("dialog", { name: "Registro rápido no Almoço" });
        await Promise.all(sheet.getAnimations({ subtree: true }).map((animation) => animation.finished));
        for (const scroller of [sheet, ...sheet.querySelectorAll<HTMLElement>("*")]) {
          const before = scroller.scrollLeft;
          scroller.scrollLeft = 50;
          expect(scroller.scrollLeft, "a folha rola de lado").toBe(before);
          scroller.scrollLeft = before;
        }
        for (const label of ["Prot. (g)", "Carb. (g)", "Gord. (g)"]) {
          const input = within(sheet).getByLabelText(label);
          expect(input.getBoundingClientRect().width, `${label} estreito demais`).toBeGreaterThanOrEqual(56);
        }
        cleanup();
      });
    }
  }
});
