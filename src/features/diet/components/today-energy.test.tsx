import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
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
 * The home screen's calorie figure.
 *
 * The case that matters most is the one with no profile: building and
 * recording a diet has never required answering anything about age or weight,
 * and a home screen that went blank without a profile would quietly make the
 * optional thing mandatory.
 */

const DAY = "2026-08-07";

/**
 * The stored shape, not the engine's input shape. `Profile` wraps
 * `NutritionProfile` under `nutrition` so that profile fields which are not
 * nutrition inputs can arrive later without touching the schema the engine
 * validates — and a fixture that flattened it would test a record the app
 * never writes.
 */
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

function logOf(kcal: number, proteinG: number): FoodLog {
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
            per100g: { kcal, proteinG, carbsG: 0, fatG: 0 },
          },
        ],
      },
    ],
  };
}

function mount(log: FoodLog | null, profile: Profile | null) {
  const logs = new LocalFoodLogRepository(
    new MemoryStore<FoodLog>(FOOD_LOGS_STORE),
  );
  const profiles = new LocalProfileRepository(
    new MemoryStore<Profile>(PROFILE_STORE),
  );

  const ready = Promise.all([
    log === null ? Promise.resolve() : logs.save(log, null),
    profile === null ? Promise.resolve() : profiles.save(profile, null),
  ]);

  render(
    <FoodLogRepositoryProvider repository={ready.then(() => logs)}>
      <ProfileRepositoryProvider repository={ready.then(() => profiles)}>
        <TodayEnergy day={DAY} />
      </ProfileRepositoryProvider>
    </FoodLogRepositoryProvider>,
  );
}

describe("without a profile", () => {
  it("still shows what was eaten, and says why there is no target", async () => {
    mount(logOf(600, 40), null);

    expect(await screen.findByText("600")).toBeInTheDocument();
    expect(screen.getByText(/Sem meta para comparar/)).toBeInTheDocument();
  });

  /**
   * Sprint 1, TODAY-04 — a duplicação saiu na origem, e este teste é o que
   * impede que ela volte.
   *
   * `ProfileIncompleteNotice` e este card punham dois links para `/perfil`
   * colados um no outro no topo de `/hoje`. O convite é do `Notice`: é ele
   * que lê `useProfile`, some sozinho quando o perfil existe e carrega o
   * botão. Aqui ficou só a constatação, **sem link** — e ela fica porque
   * `targets === null` tem três causas e o `Notice` cobre uma
   * (ver `useNutritionTargets`).
   *
   * O caminho para o diário continua obrigatório: sem meta *e* sem forma de
   * registrar, o card declararia um problema e não ofereceria nada. Era o
   * que o teste abaixo já protegia antes desta sprint.
   */
  it("does not offer a second way into the profile", async () => {
    mount(logOf(600, 40), null);
    await screen.findByText(/Sem meta para comparar/);

    const toProfile = screen
      .queryAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/perfil");

    expect(toProfile).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: "Ver diário" }),
    ).toBeInTheDocument();
  });

  it("shows no calorie ring, because there is nothing to be a fraction of", async () => {
    mount(logOf(600, 40), null);
    await screen.findByText("600");

    expect(screen.queryByText(/kcal restantes/)).not.toBeInTheDocument();
  });
});

describe("with a profile", () => {
  it("counts down what is left in the day", async () => {
    mount(logOf(600, 40), PROFILE);

    expect(await screen.findByText(/kcal restantes/)).toBeInTheDocument();
  });

  it("says how far over, rather than showing a negative remainder", async () => {
    // A ring that wrapped past its own start would draw 110% and 10% the
    // same, so the overshoot is carried by the words and the colour.
    mount(logOf(9000, 40), PROFILE);

    expect(await screen.findByText(/kcal acima da meta/)).toBeInTheDocument();
  });

  /**
   * Sprint 1 — o herói respondia uma das três perguntas.
   *
   * "Quanto resta" estava na tela; "quanto consumi" e "qual é a meta"
   * exigiam abrir o diário ou lembrar a meta de cor. Os dois números já
   * chegavam ao componente — são os mesmos que o arco recebe — e eram
   * descartados depois de virarem uma subtração.
   */
  it("names consumed and target beside what is left", async () => {
    mount(logOf(600, 40), PROFILE);
    await screen.findByText(/kcal restantes/);

    expect(
      screen.getByText(/^600 consumidas · [\d.]+ meta$/),
    ).toBeInTheDocument();
  });

  /**
   * `eatenMacros` soma `per100g.kcal * gramas / 100`, que é fracionário, e
   * `formatDecimal` sem `fractionDigits` preserva os dígitos que chegarem.
   * O herói exibia "646,63 kcal restantes".
   *
   * Arredondar é apresentação: `remaining` continua `target - consumed`.
   * Este teste existe porque é fácil "simplificar" o `Math.round` para fora
   * num refactor futuro sem perceber o que ele segura — inclusive a promessa
   * do comentário de "Number Update", que diz que dois centésimos seguidos
   * não devem fazer o número piscar.
   */
  it("shows whole calories, never the fraction the sum produces", async () => {
    mount(logOf(600.4, 40), PROFILE);
    await screen.findByText(/kcal restantes/);

    expect(screen.getByText(/^600 consumidas /)).toBeInTheDocument();
    expect(screen.queryByText(/600,4/)).not.toBeInTheDocument();
    expect(screen.queryByText(/,\d/)).not.toBeInTheDocument();
  });
});

describe("fiber", () => {
  // Pedro, 27/08/2026: "remove completamente o aviso 'meta de referência'".
  // Só o número — nenhuma explicação, e nenhum "consumido" inventado, já
  // que nenhum alimento do catálogo carrega dado de fibra.
  it("shows the flat goal without the words 'meta de referência'", async () => {
    mount(logOf(600, 40), PROFILE);
    await screen.findByText(/kcal restantes/);

    expect(screen.getByText("Fibra · 35 g/dia")).toBeInTheDocument();
    expect(screen.queryByText(/meta de referência/i)).not.toBeInTheDocument();
  });

  it("never shows a consumed value for fiber, real or fabricated", async () => {
    mount(logOf(600, 40), PROFILE);
    await screen.findByText(/kcal restantes/);

    // The other three macros read "consumido / meta" (a `Metric`); fiber
    // is deliberately not one of them, so it must never gain a "/" pair.
    expect(screen.queryByText(/^0\s*\/\s*35/)).not.toBeInTheDocument();
  });
});

describe("with nothing recorded yet", () => {
  it("invites a first entry instead of showing an empty card", async () => {
    mount(null, null);

    expect(
      await screen.findByRole("link", { name: "Registrar" }),
    ).toBeInTheDocument();
  });
});
