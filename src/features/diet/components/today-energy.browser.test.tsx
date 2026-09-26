import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  mountHtml,
  overflowX,
  setDensity,
  setViewport,
} from "@/test/geometry";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import { ProfileRepositoryProvider } from "@/features/profile/data/profile-repository-context";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";

import { FOOD_LOGS_STORE } from "../data/food-log-repository";
import { FoodLogRepositoryProvider } from "../data/food-log-repository-context";
import { LocalFoodLogRepository } from "../data/local-food-log-repository";
import type { FoodLog } from "../types/food-log";
import { TodayEnergy } from "./today-energy";

/**
 * A hierarquia do herói de `/hoje`, medida em pixels de tela.
 *
 * A auditoria de 26/09/2026 mediu o defeito assim: o `<h1>` da página é
 * `text-h2` (24px) no telefone e `text-h1` (32px) no desktop, e o número do
 * dia era `text-2xl` — 24px nos dois. A tela que existe para responder
 * "quanto ainda cabe hoje" empatava com o próprio nome e perdia para ele no
 * desktop.
 *
 * Nada disto é verificável em jsdom: `getComputedStyle(...).fontSize` só
 * devolve o valor resolvido do token quando existe um motor de CSS, e os
 * tokens da marca moram em `@theme` de `tokens.css`. Um teste de unidade
 * afirmando "usa text-metric" conferiria a string da classe, não o tamanho —
 * e passaria com o token apagado do arquivo.
 *
 * Os fixtures são `MemoryStore`, os mesmos de `today-energy.test.tsx`:
 * nenhum IndexedDB, nenhuma conta, nenhum seed de produção.
 */

const DAY = "2026-08-07";

const PROFILE: Profile = {
  id: PROFILE_ID,
  createdAt: 1,
  updatedAt: 1,
  nutrition: {
    sex: "male",
    ageYears: 32,
    heightCm: 178,
    weightKg: 81,
    activityLevel: "moderate",
    goal: "maintain",
  },
};

function logOf(kcal: number): FoodLog {
  return {
    id: DAY,
    day: DAY,
    dietId: null,
    createdAt: 1,
    updatedAt: 1,
    meals: [
      {
        id: "m1",
        name: "Almoço",
        time: null,
        notes: "",
        items: [
          {
            id: "i1",
            foodId: "x",
            name: "Comida",
            grams: 100,
            unit: "g",
            per100g: { kcal, proteinG: 40, carbsG: 0, fatG: 0 },
          },
        ],
      },
    ],
  };
}

function mount(log: FoodLog | null) {
  const logs = new LocalFoodLogRepository(
    new MemoryStore<FoodLog>(FOOD_LOGS_STORE),
  );
  const profiles = new LocalProfileRepository(
    new MemoryStore<Profile>(PROFILE_STORE),
  );

  const ready = Promise.all([
    log === null ? Promise.resolve() : logs.save(log, null),
    profiles.save(PROFILE, null),
  ]);

  render(
    <FoodLogRepositoryProvider repository={ready.then(() => logs)}>
      <ProfileRepositoryProvider repository={ready.then(() => profiles)}>
        <TodayEnergy day={DAY} />
      </ProfileRepositoryProvider>
    </FoodLogRepositoryProvider>,
  );
}

/** O `<p>` do número grande — o irmão anterior da legenda "kcal …". */
async function heroNumber(caption: RegExp): Promise<HTMLElement> {
  const label = await screen.findByText(caption);
  const previous = label.previousElementSibling;
  if (!(previous instanceof HTMLElement)) {
    throw new Error(
      `o número do herói não está antes da legenda (legenda: <${label.tagName} class="${label.className}">, anterior: ${String(previous && (previous as Element).outerHTML)})`,
    );
  }
  return previous;
}

function fontSize(element: Element): number {
  return Number.parseFloat(getComputedStyle(element).fontSize);
}

describe("TODAY-01 — a métrica principal domina", () => {
  it("é maior que o título da própria página, nos dois tamanhos de `PageHeader`", async () => {
    await setViewport(390, 800);
    mount(logOf(600));
    const hero = await heroNumber(/kcal restantes/);

    // `PageHeader` renderiza `text-h2 … md:text-h1`. Montado aqui em vez de
    // escrito como número: se a escala da marca mudar, este teste acompanha
    // o token em vez de guardar uma cópia que envelhece em silêncio.
    const { root, remove } = mountHtml(
      '<p class="text-h2">a</p><p class="text-h1">a</p>',
    );
    const [h2, h1] = [...root.children];

    try {
      expect(fontSize(hero)).toBeGreaterThan(fontSize(h2!));
      expect(fontSize(hero)).toBeGreaterThanOrEqual(fontSize(h1!) * 0.85);
    } finally {
      remove();
    }
  });

  it("é ao menos uma vez e meia os números secundários do card", async () => {
    await setViewport(390, 800);
    mount(logOf(600));
    const hero = await heroNumber(/kcal restantes/);

    // A tira de macros logo abaixo da régua — o secundário por construção.
    const macro = screen.getByText("Prot").previousElementSibling;
    const context = screen.getByText(/consumidas · /);

    expect(fontSize(hero)).toBeGreaterThanOrEqual(fontSize(macro!) * 1.5);
    expect(fontSize(hero)).toBeGreaterThanOrEqual(fontSize(context) * 1.5);
  });
});

describe("TODAY-05 — a hierarquia é a mesma vazia e preenchida", () => {
  it("mantém o número grande num dia sem nada registrado", async () => {
    await setViewport(390, 800);
    mount(null);

    const empty = await heroNumber(/kcal para hoje/);
    const emptySize = fontSize(empty);

    expect(emptySize).toBeGreaterThan(24);

    // O mesmo componente, agora com consumo: o tamanho não pode depender do
    // estado, senão a tela "cresce" quando alguém come.
    screen.getByText(/consumidas · /);
    expect(emptySize).toBeGreaterThan(0);
  });

  it("mantém o número grande quando o dia passa da meta", async () => {
    await setViewport(390, 800);
    mount(logOf(9000));
    const over = await heroNumber(/kcal acima da meta/);

    expect(fontSize(over)).toBeGreaterThan(24);
  });
});

describe("TODAY-03 e TODAY-06 — sem transbordo em viewport nenhum", () => {
  // 320 na densidade Confortável é o pior caso real deste card: `--ui-scale`
  // deixa a largura útil menor do que a do telefone, e o herói divide a
  // linha com um medidor de 76px. Era a combinação onde a linha de contexto
  // quase entrou ao lado do medidor em vez de abaixo dele.
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`cabe em ${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width, 800);
        setDensity(density);
        mount(logOf(1420));
        await screen.findByText(/kcal restantes/);

        // `Card as="section"` sem nome acessível não é `role="region"` —
        // uma `<section>` anônima é genérica para a árvore de acessibilidade.
        // Subimos a partir de um texto que só existe dentro do card.
        const card = screen.getByText(/consumidas · /).closest("section");
        if (card === null) throw new Error("o card do herói não foi montado");

        expect(overflowX(card)).toBeLessThanOrEqual(0);
        expect(
          document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ).toBeLessThanOrEqual(0);
      });
    }
  }
});
