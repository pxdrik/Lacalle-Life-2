import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { dayKey, formatDay } from "@/core/format/day";
import { MemoryStore } from "@/core/storage/memory-store";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";
import type { Food } from "@/features/foods";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import { ProfileRepositoryProvider } from "@/features/profile/data/profile-repository-context";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { DIETS_STORE } from "../data/diet-store";
import { FOOD_LOGS_STORE } from "../data/food-log-repository";
import { FoodLogRepositoryProvider } from "../data/food-log-repository-context";
import { LocalDietRepository } from "../data/local-diet-repository";
import { LocalFoodLogRepository } from "../data/local-food-log-repository";
import { createDiet, createMealItem } from "../services/create-diet";
import { addItem } from "../services/edit-diet";
import { assignWeekdays, weekdayOf, WEEKDAYS } from "../services/diet-schedule";
import type { Diet } from "../types/diet";
import type { FoodLog } from "../types/food-log";
import { FoodLogScreen } from "./food-log-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/diario",
}));

/**
 * The diary reuses the diet editor's machinery — `MealCard`, the meal
 * operations, the totals. That reuse is the point, and it is also the risk:
 * every control has to be wired to the operation it names, and nothing about
 * a shared component makes that true on its own.
 *
 * It was not true. "Duplicar" on the diary was wired to `addMeal`, so a button
 * promising a copy produced an empty meal instead — silently, on the screen
 * where somebody is recording what they actually ate.
 */

const TODAY = dayKey(new Date());

function emptyLog(): FoodLog {
  return {
    id: TODAY,
    day: TODAY,
    dietId: null,
    meals: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

function logWithMeal(): FoodLog {
  return {
    id: TODAY,
    day: TODAY,
    dietId: null,
    meals: [
      {
        id: "m1",
        name: "Café da manhã",
        time: null,
        notes: "",
        items: [
          {
            id: "i1",
            foodId: "ovo-inteiro",
            name: "Ovo inteiro",
            grams: 100,
            unit: "g",
            per100g: { kcal: 143, proteinG: 13, carbsG: 1, fatG: 10 },
          },
        ],
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

function mount(seed: FoodLog, diet?: Diet) {
  const logs = new LocalFoodLogRepository(
    new MemoryStore<FoodLog>(FOOD_LOGS_STORE),
  );
  const diets = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const foods = new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));
  const profile = new LocalProfileRepository(new MemoryStore(PROFILE_STORE));

  const ready = Promise.all([
    logs.save(seed, null),
    diet === undefined ? Promise.resolve() : diets.save(diet, null),
  ]);

  render(
    <FoodLogRepositoryProvider repository={ready.then(() => logs)}>
      <DietRepositoryProvider repository={ready.then(() => diets)}>
        <FoodRepositoryProvider repository={ready.then(() => foods)}>
          <ProfileRepositoryProvider repository={ready.then(() => profile)}>
            <FoodLogScreen day={TODAY} />
          </ProfileRepositoryProvider>
        </FoodRepositoryProvider>
      </DietRepositoryProvider>
    </FoodLogRepositoryProvider>,
  );

  return { logs, diets };
}

/** A diet with one meal, linked to today's weekday. */
function dietForToday(): Diet {
  let diet = createDiet("Cutting");
  diet = addItem(
    diet,
    diet.meals[0]!.id,
    createMealItem({
      foodId: "frango",
      name: "Peito de frango",
      grams: 150,
      per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
    }),
  );
  return assignWeekdays([diet], diet.id, [weekdayOf(new Date())])[0]!;
}

function logWithCheckedMeal(): FoodLog {
  const log = logWithMeal();
  return {
    ...log,
    meals: [
      {
        ...log.meals[0]!,
        sourceDietId: "dieta-1",
        sourceMealId: "refeicao-1",
        plannedSnapshot: log.meals[0]!.items,
      },
    ],
  };
}

describe("the check button in the diary", () => {
  it("does not show on a meal built by hand, only on one from a diet", async () => {
    mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    expect(
      screen.queryByRole("button", { name: /Marcar|Desmarcar/ }),
    ).not.toBeInTheDocument();
  });

  it("shows checked, and unchecking keeps the meal in the diary — just marked not eaten", async () => {
    // The bug this replaced: unchecking used to delete the meal outright,
    // which emptied the whole day the instant it was the only one — leaving
    // no trace of what was still left to do today.
    const { logs } = mount(logWithCheckedMeal());
    await screen.findByDisplayValue("Café da manhã");

    const button = screen.getByRole("button", {
      name: "Desmarcar Café da manhã como comida",
    });
    expect(button).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(button);

    const uncheckedButton = await screen.findByRole("button", {
      name: "Marcar Café da manhã como comida",
    });
    expect(uncheckedButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByDisplayValue("Café da manhã")).toBeInTheDocument();
    expect(
      screen.queryByText(`Nada registrado em ${formatDay(TODAY)}.`),
    ).not.toBeInTheDocument();
    await waitFor(async () => {
      expect((await logs.getByDay(TODAY))?.meals).toHaveLength(1);
    });
  });

  it("re-checking an unchecked-but-logged meal flips it back, still the same entry", async () => {
    const { logs } = mount(logWithCheckedMeal());
    await screen.findByDisplayValue("Café da manhã");

    await userEvent.click(
      screen.getByRole("button", { name: "Desmarcar Café da manhã como comida" }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Marcar Café da manhã como comida",
      }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Desmarcar Café da manhã como comida",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(async () => {
      expect((await logs.getByDay(TODAY))?.meals).toHaveLength(1);
    });
  });
});

describe("planned meals waiting to be checked", () => {
  it("does not show without a diet linked to today", async () => {
    mount(emptyLog());
    await screen.findByText(/Nada registrado em/);

    expect(screen.queryByText(/^Planejado para/)).not.toBeInTheDocument();
  });

  it("lists the linked diet's meal, with a preview of what it holds", async () => {
    // Achado real, 17/09/2026: antes desta prévia, decidir se marcar "Refeição
    // 1" como comida exigia abrir a dieta inteira para lembrar o que ela
    // tinha — só o nome da refeição não dizia nada sobre o conteúdo.
    mount(emptyLog(), dietForToday());

    expect(await screen.findByText(/^Planejado para/)).toBeInTheDocument();
    expect(screen.getByText("Peito de frango")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar Refeição 1 como comida" }),
    ).toBeInTheDocument();
  });

  it("shows nothing extra for a planned meal that still has no food in it", async () => {
    const diet = createDiet("Vazia");
    const dietToday = assignWeekdays([diet], diet.id, [
      weekdayOf(new Date()),
    ])[0]!;
    mount(emptyLog(), dietToday);

    await screen.findByText(/^Planejado para/);

    expect(
      screen.getByRole("button", { name: `Marcar ${dietToday.meals[0]!.name} como comida` }),
    ).toBeInTheDocument();
  });

  it("checking a planned meal snapshots it into the diary and drops it from the list", async () => {
    const { logs } = mount(emptyLog(), dietForToday());
    const check = await screen.findByRole("button", {
      name: "Marcar Refeição 1 como comida",
    });

    await userEvent.click(check);

    await waitFor(async () => {
      const saved = await logs.getByDay(TODAY);
      expect(saved?.meals).toHaveLength(1);
      expect(saved?.meals[0]?.items[0]).toMatchObject({
        name: "Peito de frango",
        grams: 150,
      });
    });
    expect(screen.queryByText(/^Planejado para/)).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("Refeição 1")).toBeInTheDocument();
  });

  it("tapping the row opens the meal unchecked, without claiming it was eaten", async () => {
    // Achado real, 17/09/2026: a única forma de ver ou editar uma refeição
    // planejada era marcá-la como comida primeiro — o check era o único jeito
    // de sair da linha compacta. Tocar a linha (fora do check) agora abre o
    // card cheio sem responder "comi isto" no lugar da pessoa.
    const { logs } = mount(emptyLog(), dietForToday());
    const row = await screen.findByRole("button", {
      name: "Abrir Refeição 1",
    });

    await userEvent.click(row);

    await waitFor(async () => {
      const saved = await logs.getByDay(TODAY);
      expect(saved?.meals).toHaveLength(1);
      expect(saved?.meals[0]?.eaten).toBe(false);
    });
    expect(screen.queryByText(/^Planejado para/)).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "Marcar Refeição 1 como comida",
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("'Fechar refeição', ao lado do check, undoes an open, back to the compact planned row", async () => {
    // Pedro, 17/09/2026: "vamos fazer uma funcionalidade para voltar a
    // 'fechar' o card do diário" — e depois, no mesmo dia: "pode estar do
    // lado do check, e aí pode deixar apenas o símbolo" — não mais atrás
    // do ⋮.
    const { logs } = mount(emptyLog(), dietForToday());
    await userEvent.click(
      await screen.findByRole("button", { name: "Abrir Refeição 1" }),
    );
    await screen.findByDisplayValue("Refeição 1");

    await userEvent.click(
      screen.getByRole("button", { name: "Fechar refeição" }),
    );

    expect(await screen.findByText(/^Planejado para/)).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("Refeição 1"),
    ).not.toBeInTheDocument();
    // Sem refeições, o dia inteiro é apagado do armazenamento em vez de
    // salvo vazio — a mesma regra de sempre (`isEmptyLog`), não algo novo
    // que "Fechar" precisou ensinar.
    await waitFor(async () => {
      expect(await logs.getByDay(TODAY)).toBeUndefined();
    });
  });

  it("never offers 'Fechar refeição' once the meal is checked — closing would erase a real record", async () => {
    const { logs } = mount(emptyLog(), dietForToday());
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Marcar Refeição 1 como comida",
      }),
    );
    await waitFor(async () => {
      expect((await logs.getByDay(TODAY))?.meals[0]?.eaten).toBe(true);
    });

    expect(
      screen.queryByRole("button", { name: "Fechar refeição" }),
    ).not.toBeInTheDocument();
  });

  it("drops a meal from the planned list once it is already checked", async () => {
    const diet = dietForToday();
    const seeded: FoodLog = {
      ...emptyLog(),
      meals: [
        {
          ...diet.meals[0]!,
          sourceDietId: diet.id,
          sourceMealId: diet.meals[0]!.id,
          plannedSnapshot: diet.meals[0]!.items,
        },
      ],
    };
    mount(seeded, diet);

    await screen.findByDisplayValue("Refeição 1");
    expect(screen.queryByText(/^Planejado para/)).not.toBeInTheDocument();
  });
});

describe("a day already started from a diet", () => {
  // What `startDayFromDiet` seeds: every meal already logged, unchecked —
  // the point being that all of it stays visible and editable in the
  // Diário right away, not hidden behind a check.
  function seededUnchecked(diet: Diet): FoodLog {
    return {
      ...emptyLog(),
      dietId: diet.id,
      meals: [
        {
          ...diet.meals[0]!,
          sourceDietId: diet.id,
          sourceMealId: diet.meals[0]!.id,
          plannedSnapshot: diet.meals[0]!.items,
          eaten: false,
        },
      ],
    };
  }

  it("shows the whole meal, unchecked, instead of the compact planned list", async () => {
    const diet = dietForToday();
    mount(seededUnchecked(diet), diet);

    expect(await screen.findByDisplayValue("Refeição 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar Refeição 1 como comida" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/^Planejado para/)).not.toBeInTheDocument();
  });

  it("checking it in place keeps it as the same entry, now marked eaten", async () => {
    const diet = dietForToday();
    const { logs } = mount(seededUnchecked(diet), diet);
    await screen.findByDisplayValue("Refeição 1");

    await userEvent.click(
      screen.getByRole("button", { name: "Marcar Refeição 1 como comida" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Desmarcar Refeição 1 como comida",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(async () => {
      const saved = await logs.getByDay(TODAY);
      expect(saved?.meals).toHaveLength(1);
      expect(saved?.meals[0]?.eaten).toBe(true);
    });
  });

  // Achado por um agente sem contexto do app (25/09/2026): importar uma
  // dieta pro dia deixa os totais lá em cima em zero até cada refeição ser
  // marcada — sem aviso nenhum, isso lê como "a importação falhou".
  /**
   * O mesmo comportamento que este teste sempre protegeu — a tela explica
   * por que o total lê zero, e para de explicar quando não há mais o que
   * explicar — só que num lugar melhor.
   *
   * Até a Sprint 2 a frase era um parágrafo no topo, contando refeições
   * ("1 refeição planejada ainda não foi marcada..."), longe dos números com
   * que ela discordava. Agora é uma linha em cada card planejado, colada no
   * total daquela refeição. Diz mais (qual refeição) e é lida onde a dúvida
   * nasce.
   */
  it("explains why the totals read zero, and stops once everything is checked", async () => {
    const diet = dietForToday();
    mount(seededUnchecked(diet), diet);
    await screen.findByDisplayValue("Refeição 1");

    expect(
      screen.getByText(/Planejado · ainda não somado no total do dia/),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Marcar Refeição 1 como comida" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText(/ainda não somado no total do dia/),
      ).not.toBeInTheDocument();
    });
  });

  /**
   * DIARY-03 — a matemática não mudou, e este teste é o que garante isso
   * enquanto a apresentação ao redor dela muda.
   *
   * O total do topo conta `eatenMacros`, nunca `log.meals`. Uma refeição
   * planejada é visível, editável e rotulada — e continua fora da soma.
   */
  it("keeps the day's total on what was eaten, never on what is planned", async () => {
    const diet = dietForToday();
    mount(seededUnchecked(diet), diet);
    await screen.findByDisplayValue("Refeição 1");

    // A refeição planejada mostra o próprio total no card…
    expect(
      screen.getByText(/Planejado · ainda não somado no total do dia/),
    ).toBeInTheDocument();

    // …e o resumo fixo do topo continua zerado até o check. É o primeiro
    // `<dl>` da tela por construção: o bloco `sticky` é renderizado antes de
    // "Planejado" (que é `ul`) e antes da lista de cards. Buscar por texto
    // não serve aqui — "kcal" aparece no topo *e* em cada card, e é
    // justamente essa repetição que o achado B1 trata.
    const totals = () => document.querySelectorAll("dl")[0]?.textContent ?? "";

    expect(totals()).toMatch(/^0\s*kcal/);

    await userEvent.click(
      screen.getByRole("button", { name: "Marcar Refeição 1 como comida" }),
    );

    await waitFor(() => {
      expect(totals()).not.toMatch(/^0\s*kcal/);
    });
  });
});

describe("duplicating a meal in the diary", () => {
  async function duplicate() {
    await userEvent.click(
      screen.getByRole("button", { name: "Mais ações para Café da manhã" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Duplicar" }));
  }

  it("copies the food in it, rather than adding an empty meal", async () => {
    const { logs } = mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    await duplicate();

    await waitFor(async () => {
      const saved = await logs.getByDay(TODAY);
      expect(saved?.meals).toHaveLength(2);
      expect(saved?.meals[1]?.items).toHaveLength(1);
      expect(saved?.meals[1]?.items[0]?.name).toBe("Ovo inteiro");
    });
  });

  it("keeps the copy's name, and gives it fresh ids at every depth", async () => {
    const { logs } = mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    await duplicate();

    await waitFor(async () => {
      const saved = await logs.getByDay(TODAY);
      const [original, copy] = saved?.meals ?? [];

      expect(copy?.name).toBe("Café da manhã");
      expect(copy?.id).not.toBe(original?.id);
      expect(copy?.items[0]?.id).not.toBe(original?.items[0]?.id);
    });
  });
});

describe("an empty day", () => {
  // A criação de dieta ficou acessível direto daqui, ao lado de "Adicionar
  // refeição" — sem exigir Diário → Dietas → criar como dois passos.
  it("offers a direct link to create a diet, next to 'Adicionar refeição'", async () => {
    mount(emptyLog());
    await screen.findByText(/Nada registrado em/);

    const link = screen.getByRole("link", { name: "Criar uma dieta" });
    expect(link).toHaveAttribute("href", "/dietas");
    expect(
      screen.getByRole("button", { name: "Adicionar refeição" }),
    ).toBeInTheDocument();
  });

  // Achado por um agente sem contexto do app (25/09/2026): "Começar de uma
  // dieta" é o caminho mais natural pra quem nunca vinculou nada a um dia da
  // semana, e nada nele menciona que a vinculação existe — resultado, o
  // card de aderência da Evolução fica sempre vazio sem explicação.
  it("suggests linking a diet to a weekday when nobody ever has", async () => {
    mount(emptyLog(), createDiet("Dieta livre"));
    await screen.findByText(/Nada registrado em/);

    expect(
      screen.getByText(/vincular uma dieta a dias da semana/),
    ).toBeInTheDocument();
  });

  it("stays quiet once any diet is already linked to some weekday", async () => {
    let diet = createDiet("Dieta de outro dia");
    const today = weekdayOf(new Date());
    const otherDay = WEEKDAYS.find((day) => day !== today)!;
    diet = assignWeekdays([diet], diet.id, [otherDay])[0]!;
    mount(emptyLog(), diet);
    await screen.findByText(/Nada registrado em/);

    expect(
      screen.queryByText(/vincular uma dieta a dias da semana/),
    ).not.toBeInTheDocument();
  });
});

describe("navigating to a future day", () => {
  // Passou a ser permitido: é como alguém confere se a dieta vinculada a um
  // dia da semana (`dietForWeekday`) caiu no dia certo antes de a semana
  // chegar lá. O Diário continua sem escrever nada sozinho — só passou a
  // deixar olhar.
  it("does not disable 'Próximo dia' on today", async () => {
    mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    expect(screen.getByRole("button", { name: "Próximo dia" })).toBeEnabled();
  });

  it("does not cap the date field at today", async () => {
    mount(logWithMeal());
    await screen.findByDisplayValue("Café da manhã");

    expect(screen.getByLabelText("Dia do registro")).not.toHaveAttribute(
      "max",
    );
  });
});

describe("RM01 — long press on a meal opens the day's reorder sheet", () => {
  function logWithTwoMeals(): FoodLog {
    const log = logWithMeal();
    return {
      ...log,
      meals: [
        ...log.meals,
        { id: "m2", name: "Almoço", time: null, notes: "", items: [] },
      ],
    };
  }

  it("lists every meal of the day, not just the one held", async () => {
    mount(logWithTwoMeals());
    await screen.findByDisplayValue("Café da manhã");

    // Fake timers only from here — the load above goes through the real
    // IndexedDB-backed repository, which needs real ones to ever resolve.
    vi.useFakeTimers();
    const header = screen
      .getByRole("button", { name: "Mais ações para Café da manhã" })
      .closest("header")!;
    fireEvent.pointerDown(header, {
      clientX: 0,
      clientY: 0,
      pointerType: "touch",
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();

    expect(
      await screen.findByRole("heading", { name: "Reordenar refeições" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reordenar Café da manhã" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reordenar Almoço" }),
    ).toBeInTheDocument();
  });

  it("no meal card shows a permanent drag handle", async () => {
    mount(logWithTwoMeals());
    await screen.findByDisplayValue("Café da manhã");

    expect(
      screen.queryByRole("button", { name: /^Reordenar /u }),
    ).not.toBeInTheDocument();
  });
});
