import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { pageShell } from "@/design-system/components/page-shell";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, setDensity, setViewport } from "@/test/geometry";

import { FoodRepositoryProvider } from "../data/food-repository-context";
import { FOODS_STORE } from "../data/food-store";
import { LocalFoodRepository } from "../data/local-food-repository";
import type { Food } from "../types/food";
import { FoodSelectionScreen } from "./food-selection-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ mealId: "m1", returnTo: "/diario" }),
}));

/**
 * Vários alimentos numa ida (02/10/2026), medido: "Nesta refeição" com nome
 * longo quebra linha em vez de cortar, a lixeira de cada um é tocável sem
 * cair no vizinho, e a barra de "Confirmar refeição" fica inteira na tela,
 * com a contagem e o botão lado a lado.
 */
const LONG = "Peito de frango grelhado sem pele temperado com ervas finas";
const foods: Food[] = [LONG, "Arroz integral cozido"].map((name, index) => ({
  id: `f${String(index)}`,
  name,
  category: "protein",
  unit: "g",
  per100g: { kcal: 160, proteinG: 30, carbsG: 0, fatG: 3 },
  isCustom: false,
  isFavorite: false,
  createdAt: 1,
  updatedAt: 1,
}));

function mount() {
  const repository = new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));
  render(
    <main className={pageShell()}>
      <FoodRepositoryProvider repository={Promise.all(foods.map((food) => repository.save(food, null))).then(() => repository)}>
        <FoodSelectionScreen />
      </FoodRepositoryProvider>
    </main>,
  );
}

function expectWhole(text: Element, container: Element) {
  const range = document.createRange();
  range.selectNodeContents(text);
  expect(range.getBoundingClientRect().width, "texto cortado").toBeLessThanOrEqual(text.getBoundingClientRect().width + 0.5);
  expect(text.getBoundingClientRect().right, "texto passa da borda").toBeLessThanOrEqual(container.getBoundingClientRect().right + 0.5);
}
function expectTouchable(control: HTMLElement) {
  control.scrollIntoView({ block: "center" });
  for (const hit of hitTargetsAcross(control)) {
    expect(control.contains(hit), "o toque cai em outro elemento").toBe(true);
  }
}
const apart = (a: DOMRect, b: DOMRect) =>
  a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;
const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;

describe("vários alimentos numa ida", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 800);
        setDensity(density);
        mount();
        await waitFor(() => {
          expect(screen.getByLabelText("Buscar alimento para adicionar")).not.toBeDisabled();
        });
        for (const [query, start] of [["peito", /^Peito de frango/], ["arroz", /^Arroz integral/]] as const) {
          const search = screen.getByLabelText("Buscar alimento para adicionar");
          await userEvent.clear(search);
          await userEvent.type(search, query);
          await userEvent.click(await screen.findByRole("button", { name: start }));
          await userEvent.click(screen.getByRole("button", { name: "Adicionar à refeição" }));
        }

        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);

        // A linha do alimento escolhido, marcada: nome longo e "Adicionado" inteiros.
        const marked = screen.getByRole("button", { name: /^Peito de frango.*Adicionado/ });
        for (const text of marked.firstElementChild!.children) expectWhole(text, marked);

        const confirm = screen.getByRole("button", { name: "Confirmar refeição" });
        const bar = confirm.parentElement!;
        bar.scrollIntoView({ block: "end" });
        expect(bar.getBoundingClientRect().bottom, "a barra passa do fim da tela").toBeLessThanOrEqual(window.innerHeight + 0.5);
        expect(bar.getBoundingClientRect().right, "a barra passa da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        const review = screen.getByRole("button", { name: "2 alimentos" });
        expect(apart(review.getBoundingClientRect(), confirm.getBoundingClientRect()), "contagem e botão encavalados").toBe(true);
        expectTouchable(confirm);
        expectTouchable(review);

        // A conferência: cada alimento inteiro, a lixeira tocável, a folha dentro da tela.
        await userEvent.click(review);
        const sheet = await screen.findByRole("dialog", { name: "Nesta refeição" });
        await Promise.all(sheet.getAnimations({ subtree: true }).map((animation) => animation.finished));
        expect(sheet.getBoundingClientRect().right, "a folha passa da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        const rows = within(sheet).getAllByRole("listitem");
        expect(rows).toHaveLength(2);
        for (const row of rows) {
          for (const text of row.firstElementChild!.children) expectWhole(text, row);
          const remove = within(row).getByRole("button");
          expectTouchable(remove);
          expect(remove.getBoundingClientRect().height).toBeGreaterThanOrEqual(43.5);
        }
        expectTouchable(within(sheet).getByRole("button", { name: "Confirmar refeição" }));
        cleanup();
      });
    }
  }
});
