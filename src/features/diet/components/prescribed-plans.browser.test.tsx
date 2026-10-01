import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { pageShell } from "@/design-system/components/page-shell";
import { ToastProvider } from "@/design-system/components/toast";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, setDensity, setViewport } from "@/test/geometry";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { DIETS_STORE } from "../data/diet-store";
import { LocalDietRepository } from "../data/local-diet-repository";
import { LocalPrescribedPlanRepository, PRESCRIBED_PLANS_STORE } from "../data/prescribed-plan-repository";
import { PrescribedPlanRepositoryProvider } from "../data/prescribed-plan-repository-context";
import { createMeal, createMealItem } from "../services/create-diet";
import type { Diet } from "../types/diet";
import type { PrescribedPlan } from "../types/prescribed-plan";
import { DietList } from "./diet-list";
import { PlanBehindOwnDiet, PlanOfDay, TodayOption } from "./plan-of-day";
import { PrescribedPlanScreen } from "./prescribed-plan-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * O plano da nutricionista no app do paciente (Life Pro, Etapa 5), medido:
 * em Dietas e na tela de leitura, nome e orientação longos quebram linha em
 * vez de sumir na borda, nada rola de lado, e "Fazer uma cópia" e "Mais
 * opções" são tocáveis onde são desenhados. A folha de opções cabe na tela.
 */
const NAME = "Recomposição corporal com déficit leve e treino de força";
const NOTE = "Comece pela salada. O azeite é medido: uma colher de sobremesa, nunca a olho, nem no fim de semana.";
const PRO = "Marina Faria de Albuquerque";
const item = (name: string) =>
  createMealItem({ foodId: null, name, grams: 150, unit: "g", per100g: { kcal: 130, proteinG: 10, carbsG: 20, fatG: 2 } });
const PLAN: PrescribedPlan = {
  id: "p",
  name: NAME,
  professionalName: PRO,
  version: 3,
  publishedAt: "2026-09-26T12:00:00Z",
  meals: ["Café da manhã", "Almoço"].map((name, index) => ({
    ...createMeal(index + 1, name),
    notes: NOTE,
    items: [item("Peito de frango grelhado sem pele"), item("Arroz integral cozido")],
    alternatives: [{ id: `a${String(index)}`, name: "Marmita de macarrão com frango desfiado", items: [item("Macarrão cozido")] }],
  })),
  previous: {
    version: 2,
    meals: [{ ...createMeal(1, "Café da manhã"), items: [item("Pão francês com manteiga e queijo minas")] }],
  },
  changeNote: "Troquei o jantar e aumentei a proteína do lanche da tarde, como combinamos na consulta.",
  weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  linkEnded: false,
  seenVersion: 2,
  createdAt: 1,
  updatedAt: 1,
};

async function mount(page: React.ReactNode) {
  const plans = new LocalPrescribedPlanRepository(new MemoryStore<PrescribedPlan>(PRESCRIBED_PLANS_STORE));
  await plans.replaceAll([PLAN]);
  await plans.markSeen("p", 2);
  render(
    <ToastProvider>
      <main className={pageShell()}>
        <DietRepositoryProvider repository={Promise.resolve(new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE)))}>
          <PrescribedPlanRepositoryProvider repository={Promise.resolve(plans)}>{page}</PrescribedPlanRepositoryProvider>
        </DietRepositoryProvider>
      </main>
    </ToastProvider>,
  );
}

/** A largura do texto em si: maior que a caixa dele é texto cortado. */
function textWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}

function expectWhole(text: HTMLElement, container: Element) {
  expect(textWidth(text), "texto cortado").toBeLessThanOrEqual(text.getBoundingClientRect().width + 0.5);
  expect(text.getBoundingClientRect().right, "texto passa da borda").toBeLessThanOrEqual(container.getBoundingClientRect().right + 0.5);
}

/** Rola até o controle antes: fora da tela, `elementFromPoint` não acha nada. */
function expectTouchable(control: HTMLElement) {
  control.scrollIntoView({ block: "center" });
  for (const hit of hitTargetsAcross(control)) {
    expect(control.contains(hit), `o toque em "${control.textContent ?? ""}" cai em outro elemento`).toBe(true);
  }
}

const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
const WIDTHS = [...PHONE_WIDTHS, DESKTOP_WIDTH];

describe("Dietas: da sua nutricionista", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        await mount(<DietList />);

        const name = await screen.findByText(NAME);
        const card = name.closest("li")!;
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        expectWhole(name, card);
        expectWhole(within(card).getByText(/Marina Faria de Albuquerque · versão 3/), card);
        for (const badge of [within(card).getByText("Profissional"), within(card).getByText("Atualizado")]) {
          expect(badge.getBoundingClientRect().right).toBeLessThanOrEqual(card.getBoundingClientRect().right + 0.5);
        }
        const copy = within(card).getByRole("button", { name: "Fazer uma cópia" });
        const days = within(card).getByRole("button", { name: /Dias do plano/ });
        expectTouchable(copy);
        expectTouchable(days);
        // A versão nova: o aviso quebra linha, e a folha do que mudou cabe na tela.
        const notice = within(card).getByText(/atualizou seu plano/);
        expectWhole(notice, card);
        const changes = within(card).getByRole("button", { name: "Ver o que mudou" });
        expectTouchable(changes);
        await userEvent.click(changes);
        const sheet = await screen.findByRole("dialog");
        await Promise.all(sheet.getAnimations({ subtree: true }).map((animation) => animation.finished));
        expectWhole(within(sheet).getByText(/Troquei o jantar/), sheet);
        expectWhole(within(sheet).getByText(/Café da manhã: saiu do plano/), sheet);
        expectWhole(within(sheet).getByText(/Total do dia:/), sheet);
        const sheetBox = sheet.getBoundingClientRect();
        expect(sheetBox.right, "a folha passa da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        await userEvent.click(within(sheet).getByRole("button", { name: "Fechar" }));

        // Lado a lado ou um embaixo do outro (quebram em 320px Confortável),
        // nunca um por cima do outro.
        const a = days.getBoundingClientRect();
        const b = copy.getBoundingClientRect();
        const apart = a.right <= b.left + 0.5 || a.bottom <= b.top + 0.5;
        expect(apart, "dias e cópia encavalados").toBe(true);
        cleanup();
      });
    }
  }
});

describe("o plano aberto para leitura", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        await mount(<PrescribedPlanScreen planId="p" />);

        const heading = await screen.findByRole("heading", { level: 1, name: NAME });
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        const main = document.querySelector("main")!;
        expectWhole(heading, main);
        const [note] = screen.getAllByText(NOTE);
        expectWhole(note!, note!.closest("li")!);
        expectTouchable(screen.getByRole("button", { name: "Fazer uma cópia" }));
        const [more] = screen.getAllByRole("button", { name: "Mais 1 opção para esta refeição" });
        expectTouchable(more!);

        await userEvent.click(more!);
        const dialog = await screen.findByRole("dialog");
        await Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished));
        const option = within(dialog).getByText("Marmita de macarrão com frango desfiado");
        expectWhole(option, option.closest("li")!);
        const box = dialog.getBoundingClientRect();
        expect(box.left, "a folha passa da tela").toBeGreaterThanOrEqual(-0.5);
        expect(box.right, "a folha passa da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        cleanup();
      });
    }
  }
});

describe("no Diário: plano de hoje e opção de hoje", () => {
  const meal = PLAN.meals[0]!;
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        await mount(
          <>
            <PlanOfDay plan={PLAN} />
            <PlanBehindOwnDiet plan={PLAN} dietName="Cutting de verão com refeição livre" planDays={["mon", "tue", "wed", "fri", "sat", "sun"]} />
            <TodayOption meal={{ ...meal, plannedSnapshot: meal.items }} planMeal={meal} onChoose={() => undefined} />
          </>,
        );

        const source = await screen.findByText(/Plano de hoje:/);
        const main = document.querySelector("main")!;
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        expectWhole(source, main);
        expectWhole(screen.getByText(/Hoje vale a sua dieta/), main);
        expectTouchable(screen.getByRole("link", { name: "Mudar os dias em Dietas" }));
        const option = screen.getByRole("button", { name: /opção de hoje: Principal/ });
        expectWhole(option.querySelector("span")!, option);
        expectTouchable(option);

        await userEvent.click(option);
        const dialog = await screen.findByRole("dialog");
        // A folha sobe de baixo: medir antes de ela parar mede o meio do caminho.
        await Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished));
        const choice = within(dialog).getByRole("button", { name: /Marmita de macarrão com frango desfiado/ });
        expectTouchable(choice);
        const box = dialog.getBoundingClientRect();
        expect(box.left, "a folha passa da tela").toBeGreaterThanOrEqual(-0.5);
        expect(box.right, "a folha passa da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        cleanup();
      });
    }
  }
});
