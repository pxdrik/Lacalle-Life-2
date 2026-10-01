import { cleanup, render, screen } from "@testing-library/react";
import { LayoutDashboard, Users } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { WorkspaceShell } from "@/design-system/components/workspace-shell";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { DietEditor } from "@/features/diet/components/diet-editor";
import { DietRepositoryProvider } from "@/features/diet/data/diet-repository-context";
import { DIETS_STORE } from "@/features/diet/data/diet-store";
import { LocalDietRepository } from "@/features/diet/data/local-diet-repository";
import { createMeal, createMealItem } from "@/features/diet/services/create-diet";
import type { Diet } from "@/features/diet/types/diet";
import type { Food } from "@/features/foods";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, setDensity, setViewport } from "@/test/geometry";

import type { PlanRepository } from "../../data/plan-repository";
import { PlanRepositoryProvider } from "../../data/plan-repository-context";
import { PlanPublishPanel } from "./plan-publish-panel";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pro/pacientes/l/plano/p",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * O editor de dieta do app dentro do Life Pro (Etapa 5), medido. É a mesma
 * tela de `/dietas/[id]`, mas noutra casca: a do Life Pro tem cabeçalho
 * próprio abaixo de `lg` e vai até 1600px. Três coisas que só existem depois
 * do layout:
 *
 * - nada rola de lado;
 * - "Publicar" e a nota cabem na tela;
 * - a barra de totais, que gruda no topo ao rolar, continua visível, e não
 *   escondida atrás de outro cabeçalho grudado no topo.
 */
const PLAN: Diet = {
  id: "p",
  name: "Recomposição com um nome comprido para quebrar linha",
  weekdays: [],
  createdAt: 1,
  updatedAt: 1,
  meals: ["Café da manhã", "Almoço", "Lanche da tarde", "Jantar"].map((name, index) => ({
    ...createMeal(index + 1, name),
    notes: "Comece pela salada. O azeite é medido: 1 colher de sobremesa.",
    items: ["Arroz branco cozido", "Feijão carioca cozido", "Peito de frango grelhado"].map((food) =>
      createMealItem({ foodId: null, name: food, grams: 150, unit: "g", per100g: { kcal: 130, proteinG: 10, carbsG: 20, fatG: 2 } }),
    ),
  })),
};

const PLANS: PlanRepository = {
  listPlans: () =>
    Promise.resolve([
      { id: "p", name: PLAN.name, hasDraft: true, versions: [{ version: 2, name: PLAN.name, changeNote: "", publishedAt: "2026-09-26T12:00:00Z", meals: [] }] },
    ]),
  createPlan: () => Promise.resolve("p"),
  publish: () => Promise.resolve(3),
};

async function mount() {
  const diets = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  await diets.save(PLAN, null);
  render(
    <ThemeProvider>
      <PlanRepositoryProvider repository={PLANS}>
        <DietRepositoryProvider repository={Promise.resolve(diets)}>
          <FoodRepositoryProvider repository={Promise.resolve(new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE)))}>
            <WorkspaceShell
              badge="Pro"
              title="Consultório"
              links={[
                { href: "/pro", label: "Visão geral", icon: LayoutDashboard },
                { href: "/pro/pacientes", label: "Pacientes", icon: Users },
              ]}
            >
              <DietEditor dietId="p" backHref="/pro/pacientes" backLabel="Paciente" nameLabel="Nome do plano" showTargets={false} />
              <PlanPublishPanel linkId="l" planId="p" patientHref="/pro/pacientes" />
            </WorkspaceShell>
          </FoodRepositoryProvider>
        </DietRepositoryProvider>
      </PlanRepositoryProvider>
    </ThemeProvider>,
  );
}

const WIDTHS = [...PHONE_WIDTHS, 768, DESKTOP_WIDTH, 1440, 1600];

describe("editor do plano no Life Pro", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 800);
        setDensity(density);
        await mount();

        const publish = await screen.findByRole("button", { name: "Publicar versão 3" });
        const root = document.documentElement;
        expect(root.scrollWidth - root.clientWidth, "a página rola de lado").toBeLessThanOrEqual(0);

        const note = screen.getByLabelText("O que mudou (opcional)");
        for (const element of [publish, note]) {
          const box = element.getBoundingClientRect();
          expect(box.left, "fora da tela").toBeGreaterThanOrEqual(-0.5);
          expect(box.right, "fora da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        }

        // Rola até o meio do plano: a barra de totais gruda no topo e tem que
        // ser o que o ponteiro atinge ali, não o cabeçalho do Life Pro.
        window.scrollTo(0, 700);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const bar = document.querySelector("main .sticky")!;
        const box = bar.getBoundingClientRect();
        expect(box.top, "a barra de totais não grudou").toBeLessThanOrEqual(1);
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        expect(bar.contains(hit), "a barra de totais está escondida atrás de outro elemento").toBe(true);

        window.scrollTo(0, 0);
        cleanup();
      });
    }
  }
});
