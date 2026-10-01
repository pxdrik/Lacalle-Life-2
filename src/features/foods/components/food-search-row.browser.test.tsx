import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  placeholderSlack,
  setDensity,
  setViewport,
} from "@/test/geometry";

import { FoodRepositoryProvider } from "../data/food-repository-context";
import type { FoodRepository } from "../data/food-repository";
import { FoodBrowser } from "./food-browser";
import { FoodPicker } from "./food-picker";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/**
 * Roadmap 8.21 (30/09/2026): a linha da busca, na tela Alimentos e no seletor
 * do Diário. Em 320px Confortável o campo ficava com 56px ("Bu…"), porque os
 * botões só com ícone carregavam o padding do rótulo e a altura com zoom
 * (57px, contra os 44 do campo). Exercícios tem a mesma checagem em
 * `exercise-groups.browser.test.tsx`.
 *
 * A fonte aqui não é a IBM Plex do app, e sim a de reserva do navegador de
 * teste: a folga medida difere da real (no app, 23px em 320 Confortável).
 */
function mount() {
  const repository: FoodRepository = {
    listAll: vi.fn().mockResolvedValue([]),
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
        <FoodBrowser />
      </FoodRepositoryProvider>
    </main>,
  );
}

describe("8.21 — a busca de alimento não fica espremida", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount();

        const fields = await screen.findAllByRole<HTMLInputElement>("searchbox");
        expect(fields).toHaveLength(2);
        for (const field of fields) {
          expect(placeholderSlack(field), `"${field.placeholder}" cortado`).toBeGreaterThanOrEqual(0);
          const height = field.getBoundingClientRect().height;
          for (const button of [...field.parentElement!.children].filter((child) => child !== field)) {
            expect(button.getBoundingClientRect().height, button.getAttribute("aria-label") ?? "").toBeCloseTo(height, 0);
          }
        }
        cleanup();
      });
    }
  }
});
