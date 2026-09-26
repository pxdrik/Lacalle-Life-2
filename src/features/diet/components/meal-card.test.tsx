import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Meal, MealItem } from "../types/diet";
import { MealCard } from "./meal-card";

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: "i1",
    foodId: "abacate",
    name: "Abacate",
    grams: 100,
    unit: "g",
    per100g: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 },
    ...overrides,
  };
}

function meal(items: readonly MealItem[]): Meal {
  return { id: "m1", name: "Refeição 1", time: null, notes: "", items };
}

function mount(
  theMeal: Meal,
  extra: {
    readonly position?: number;
    readonly total?: number;
    readonly onRemove?: () => void;
    readonly onDuplicate?: () => void;
    readonly onMove?: (offset: number) => void;
    readonly checkState?: "unchecked" | "checked" | "edited";
    readonly onToggleChecked?: () => void;
    readonly onSaveAlternative?: (name: string) => void;
    readonly onApplyAlternative?: (alternativeId: string) => void;
    readonly onRenameAlternative?: (alternativeId: string, name: string) => void;
    readonly onRemoveAlternative?: (alternativeId: string) => void;
    readonly onConsolidate?: (name: string, category: string) => void;
    readonly onUndoConsolidate?: () => void;
  } = {},
) {
  const card = (theMeal: Meal) => (
    <MealCard
      meal={theMeal}
      position={0}
      total={1}
      dragHandle={{ attributes: {}, listeners: undefined, isDragging: false }}
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
      {...extra}
    />
  );

  const { rerender } = render(card(theMeal));

  return {
    /** Re-renders with a different meal — same other props. */
    update: (nextMeal: Meal) => {
      rerender(card(nextMeal));
    },
  };
}

describe("the check button", () => {
  it("does not render without onToggleChecked", () => {
    mount(meal([]));

    expect(
      screen.queryByRole("button", { name: /Marcar|Desmarcar/ }),
    ).not.toBeInTheDocument();
  });

  it("renders unchecked and calls back on click", async () => {
    const onToggleChecked = vi.fn();
    mount(meal([]), { checkState: "unchecked", onToggleChecked });

    const button = screen.getByRole("button", {
      name: "Marcar Refeição 1 como comida",
    });
    expect(button).toHaveAttribute("aria-pressed", "false");

    button.click();
    expect(onToggleChecked).toHaveBeenCalledTimes(1);
  });

  it("reads as checked when told to", () => {
    mount(meal([]), { checkState: "checked", onToggleChecked: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Desmarcar Refeição 1 como comida" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("reads as edited, with a different icon, once the log diverges from the plan", () => {
    mount(meal([]), { checkState: "edited", onToggleChecked: vi.fn() });

    const button = screen.getByRole("button", {
      name: "Desmarcar Refeição 1 como comida",
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("title", "Comido, mas diferente do planejado");
  });

});

describe("other suggestions", () => {
  it("does not render without onApplyAlternative — a checked day has nothing to suggest", () => {
    mount(meal([]));

    expect(
      screen.queryByRole("button", { name: /Outras sugestões/ }),
    ).not.toBeInTheDocument();
  });

  it("opens to an empty state when nothing was saved yet", async () => {
    const user = userEvent.setup();
    mount(meal([item()]), { onApplyAlternative: vi.fn() });

    await user.click(screen.getByRole("button", { name: /Outras sugestões/ }));

    expect(
      screen.getByText(/Nenhuma sugestão salva ainda/),
    ).toBeInTheDocument();
  });

  it("saves the current foods under the typed name", async () => {
    const user = userEvent.setup();
    const onSaveAlternative = vi.fn();
    mount(meal([item()]), {
      onApplyAlternative: vi.fn(),
      onSaveAlternative,
    });

    await user.click(screen.getByRole("button", { name: /Outras sugestões/ }));
    await user.type(
      screen.getByLabelText("Nome da nova sugestão"),
      "Marmita de arroz",
    );
    await user.click(screen.getByRole("button", { name: "Salvar atual" }));

    expect(onSaveAlternative).toHaveBeenCalledExactlyOnceWith(
      "Marmita de arroz",
    );
  });

  it("lists a saved suggestion and applies it on 'Usar'", async () => {
    const user = userEvent.setup();
    const onApplyAlternative = vi.fn();
    const withAlternative: Meal = {
      ...meal([item()]),
      alternatives: [
        {
          id: "alt-1",
          name: "Marmita de macarrão",
          items: [item({ id: "i2", name: "Macarrão" })],
        },
      ],
    };
    mount(withAlternative, { onApplyAlternative });

    await user.click(screen.getByRole("button", { name: /Outras sugestões/ }));

    expect(screen.getByDisplayValue("Marmita de macarrão")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Usar" }));

    expect(onApplyAlternative).toHaveBeenCalledExactlyOnceWith("alt-1");
  });
});

describe("the actions menu (⋮)", () => {
  // Regressão real que este bloco existe pra pegar de novo (comentário do
  // topo do arquivo): "Duplicar" já esteve ligado em `addMeal` por engano,
  // produzindo uma refeição vazia em vez de uma cópia — silenciosamente, na
  // tela onde a pessoa registra o que de fato comeu. Reorganizar os quatro
  // botões atrás do ⋮ (17/09/2026) é exatamente o tipo de mudança que
  // reintroduziria esse bug se um dos quatro ficasse ligado à ação errada.
  async function openMenu() {
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Mais ações para Refeição 1" }),
    );
    return user;
  }

  it("duplicar chama onDuplicate, e só onDuplicate", async () => {
    const onDuplicate = vi.fn();
    mount(meal([]), { onDuplicate });
    const user = await openMenu();

    await user.click(screen.getByRole("button", { name: "Duplicar" }));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("mover para cima chama onMove(-1)", async () => {
    const onMove = vi.fn();
    mount(meal([]), { onMove, position: 1, total: 2 });
    const user = await openMenu();

    await user.click(screen.getByRole("button", { name: "Mover para cima" }));

    expect(onMove).toHaveBeenCalledExactlyOnceWith(-1);
  });

  it("mover para baixo chama onMove(1)", async () => {
    const onMove = vi.fn();
    mount(meal([]), { onMove, position: 0, total: 2 });
    const user = await openMenu();

    await user.click(screen.getByRole("button", { name: "Mover para baixo" }));

    expect(onMove).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("desabilita mover para cima na primeira posição, e para baixo na última", async () => {
    mount(meal([]), { position: 0, total: 1 });
    await openMenu();

    expect(screen.getByRole("button", { name: "Mover para cima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mover para baixo" })).toBeDisabled();
  });

  it("excluir pede confirmação antes de chamar onRemove", async () => {
    const onRemove = vi.fn();
    mount(meal([]), { onRemove });
    const user = await openMenu();

    const remove = screen.getByRole("button", { name: "Excluir Refeição 1" });
    await user.click(remove);
    expect(onRemove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Excluir?: Excluir Refeição 1" }));
    expect(onRemove).not.toHaveBeenCalled();

    // Delete/Collapse: confirming only starts the shrink; `onRemove` fires
    // once the card's own collapse transition actually ends.
    fireEvent.transitionEnd(
      screen
        .getByRole("button", { name: "Mais ações para Refeição 1" })
        .closest(".grid")!,
      { propertyName: "grid-template-rows" },
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

/**
 * Pedro, 23/09/2026: "minha refeição foi arroz, feijão, carne e purê, mas
 * quero um botão pra transformar ela em 'marmita de carne'".
 */
describe("transformar em 1 alimento", () => {
  function twoItems() {
    return meal([
      item({ id: "i1", name: "Arroz" }),
      item({ id: "i2", name: "Feijão" }),
    ]);
  }

  async function openMenu() {
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Mais ações para Refeição 1" }),
    );
    return user;
  }

  it("não aparece sem onConsolidate", async () => {
    mount(twoItems());
    await openMenu();

    expect(
      screen.queryByRole("button", { name: "Transformar em 1 alimento" }),
    ).not.toBeInTheDocument();
  });

  it("não aparece com só 1 alimento, mesmo com onConsolidate", async () => {
    mount(meal([item({ id: "i1", name: "Arroz" })]), {
      onConsolidate: vi.fn(),
    });
    await openMenu();

    expect(
      screen.queryByRole("button", { name: "Transformar em 1 alimento" }),
    ).not.toBeInTheDocument();
  });

  it("abre um formulário pedindo o nome do novo alimento", async () => {
    mount(twoItems(), { onConsolidate: vi.fn() });
    const user = await openMenu();

    await user.click(
      screen.getByRole("button", { name: "Transformar em 1 alimento" }),
    );

    expect(
      screen.getByRole("heading", { name: "Transformar Refeição 1 em 1 alimento" }),
    ).toBeInTheDocument();
  });

  it("o botão de confirmar fica desabilitado até um nome ser digitado", async () => {
    mount(twoItems(), { onConsolidate: vi.fn() });
    const user = await openMenu();
    await user.click(
      screen.getByRole("button", { name: "Transformar em 1 alimento" }),
    );

    expect(
      screen.getByRole("button", { name: "Transformar" }),
    ).toBeDisabled();
  });

  it("chama onConsolidate com o nome digitado e a categoria padrão", async () => {
    const onConsolidate = vi.fn();
    mount(twoItems(), { onConsolidate });
    const user = await openMenu();
    await user.click(
      screen.getByRole("button", { name: "Transformar em 1 alimento" }),
    );

    await user.type(
      screen.getByLabelText("Nome do novo alimento"),
      "Marmita de carne",
    );
    await user.click(screen.getByRole("button", { name: "Transformar" }));

    expect(onConsolidate).toHaveBeenCalledExactlyOnceWith(
      "Marmita de carne",
      "protein",
    );
    expect(
      screen.queryByRole("heading", {
        name: "Transformar Refeição 1 em 1 alimento",
      }),
    ).not.toBeInTheDocument();
  });

  it("deixa escolher outra categoria além do padrão", async () => {
    const onConsolidate = vi.fn();
    mount(twoItems(), { onConsolidate });
    const user = await openMenu();
    await user.click(
      screen.getByRole("button", { name: "Transformar em 1 alimento" }),
    );

    await user.type(
      screen.getByLabelText("Nome do novo alimento"),
      "Marmita de carne",
    );
    await user.selectOptions(screen.getByLabelText("Categoria"), "carb");
    await user.click(screen.getByRole("button", { name: "Transformar" }));

    expect(onConsolidate).toHaveBeenCalledExactlyOnceWith(
      "Marmita de carne",
      "carb",
    );
  });
});

/**
 * Pedro, 24/09/2026: "quero que apareça o desfazer para uma refeição que eu
 * ja juntei" — precisa continuar disponível bem depois do toast que a
 * transformação em si já mostrou.
 */
describe("desfazer transformação", () => {
  function consolidatedMeal() {
    return {
      ...meal([item({ id: "i1", name: "Marmita de carne" })]),
      consolidatedFrom: [
        item({ id: "old1", name: "Arroz" }),
        item({ id: "old2", name: "Feijão" }),
      ],
    };
  }

  async function openMenu() {
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Mais ações para Refeição 1" }),
    );
    return user;
  }

  it("não aparece sem onUndoConsolidate", async () => {
    mount(consolidatedMeal());
    await openMenu();

    expect(
      screen.queryByRole("button", { name: "Desfazer transformação" }),
    ).not.toBeInTheDocument();
  });

  it("não aparece numa refeição que nunca foi transformada, mesmo com onUndoConsolidate", async () => {
    mount(meal([item({ id: "i1" }), item({ id: "i2", name: "Banana" })]), {
      onUndoConsolidate: vi.fn(),
    });
    await openMenu();

    expect(
      screen.queryByRole("button", { name: "Desfazer transformação" }),
    ).not.toBeInTheDocument();
  });

  it("chama onUndoConsolidate ao clicar", async () => {
    const onUndoConsolidate = vi.fn();
    mount(consolidatedMeal(), { onUndoConsolidate });
    const user = await openMenu();

    await user.click(
      screen.getByRole("button", { name: "Desfazer transformação" }),
    );

    expect(onUndoConsolidate).toHaveBeenCalledTimes(1);
  });
});

describe("the newly added item's entrance", () => {
  it("does not animate on the initial render — nothing was just added", () => {
    mount(meal([item({ id: "i1" })]));

    // `getAllByText`, não `getByText`: o mesmo nome também é o título do
    // `Dialog` de ações do item (sempre no DOM, só fechado) — o primeiro
    // elemento é o `<span>` da linha. `.overflow-hidden`, não `li`: o `li`
    // virou só a trilha de grid do Delete/Collapse
    // (`useCollapsibleRemove`), e a entrada continua no div visual por
    // baixo dele.
    const row = screen.getAllByText("Abacate")[0]?.closest(".overflow-hidden");
    expect(row).not.toHaveClass("animate-rise");
  });

  it("animates only the item that was appended", () => {
    const { update } = mount(meal([item({ id: "i1" })]));

    update(
      meal([item({ id: "i1" }), item({ id: "i2", name: "Banana" })]),
    );

    const existing = screen
      .getAllByText("Abacate")[0]
      ?.closest(".overflow-hidden");
    const added = screen
      .getAllByText("Banana")[0]
      ?.closest(".overflow-hidden");
    expect(existing).not.toHaveClass("animate-rise");
    expect(added).toHaveClass("animate-rise");
  });
});

describe("RM01 — long press instead of a permanent handle in the Diário", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** No `dragHandle` at all — the Diário's own shape, never `DietEditor`'s. */
  function mountLongPress(
    theMeal: Meal,
    onLongPressReorder = vi.fn(),
    onReorderItems = vi.fn(),
  ) {
    render(
      <MealCard
        meal={theMeal}
        position={0}
        total={1}
        onLongPressReorder={onLongPressReorder}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
        onMove={vi.fn()}
        onAddFoodClick={vi.fn()}
        onItemGramsChange={vi.fn()}
        onRemoveItem={vi.fn()}
        onReorderItems={onReorderItems}
        otherMeals={[]}
        onSendItem={vi.fn()}
      />,
    );

    return { onLongPressReorder, onReorderItems };
  }

  function press(target: HTMLElement) {
    fireEvent.pointerDown(target, {
      clientX: 0,
      clientY: 0,
      pointerType: "touch",
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
  }

  it("renders no meal-level drag handle", () => {
    mountLongPress(meal([]));

    expect(
      screen.queryByRole("button", { name: "Reordenar Refeição 1" }),
    ).not.toBeInTheDocument();
  });

  it("holding the header opens the day's reorder sheet", () => {
    const { onLongPressReorder } = mountLongPress(meal([]));

    press(
      screen.getByRole("button", { name: "Mais ações para Refeição 1" })
        .closest("header")!,
    );

    expect(onLongPressReorder).toHaveBeenCalledOnce();
  });

  it("renders no item-level drag handle either", () => {
    mountLongPress(meal([item()]));

    expect(
      screen.queryByRole("button", { name: "Reordenar Abacate" }),
    ).not.toBeInTheDocument();
  });

  it("holding an item opens this meal's own reorder sheet, not the day's", () => {
    const { onLongPressReorder } = mountLongPress(
      meal([item(), item({ id: "i2", name: "Banana" })]),
    );

    const row = screen.getAllByText("Abacate")[0]!.closest("li")!
      .firstElementChild as HTMLElement;
    press(row);

    expect(
      screen.getByRole("heading", { name: "Reordenar alimentos de Refeição 1" }),
    ).toBeInTheDocument();
    expect(onLongPressReorder).not.toHaveBeenCalled();
  });
});

/**
 * Sprint 2, achado B1 — planejado e consumido eram o mesmo card.
 *
 * A diferença ficava num ícone de 32px, e o total da refeição aparecia com a
 * mesma tipografia nos dois casos, enquanto o total do topo do Diário conta
 * só o que foi comido. Quem importava uma dieta via "731 kcal" em cada
 * refeição e um total que não batia.
 *
 * A marcação é só do estado excepcional. Comido é o caso comum e nunca teve
 * marcação — uma refeição montada à mão não tem check e sempre contou.
 */
describe("estado planejado", () => {
  const PLANNED = /Planejado · ainda não somado/;

  it("diz que a refeição planejada não entra no total do dia", () => {
    mount(meal([item()]), { checkState: "unchecked", onToggleChecked: vi.fn() });

    expect(screen.getByText(PLANNED)).toBeInTheDocument();
  });

  it.each(["checked", "edited"] as const)(
    "não marca uma refeição já comida (%s)",
    (checkState) => {
      mount(meal([item()]), { checkState, onToggleChecked: vi.fn() });

      expect(screen.queryByText(PLANNED)).not.toBeInTheDocument();
    },
  );

  /**
   * O caso que protege o `DietEditor`. Ele não passa `checkState`, e lá
   * `undefined` quer dizer "esta tela é um plano, não um dia" — marcar todo
   * card de dieta como "planejado" seria verdade e ruído ao mesmo tempo.
   * É também a refeição montada à mão no Diário, que sempre contou.
   */
  it("não marca nada quando a tela não é um dia (editor de dietas)", () => {
    mount(meal([item()]));

    expect(screen.queryByText(PLANNED)).not.toBeInTheDocument();
  });

  it("some assim que a refeição é marcada como comida", () => {
    const { update } = mount(meal([item()]), {
      checkState: "unchecked",
      onToggleChecked: vi.fn(),
    });
    expect(screen.getByText(PLANNED)).toBeInTheDocument();

    // O mesmo card, agora comido — o estado vem da prop, não de estado
    // interno que pudesse ficar preso.
    cleanup();
    mount(meal([item()]), { checkState: "checked", onToggleChecked: vi.fn() });
    expect(screen.queryByText(PLANNED)).not.toBeInTheDocument();
    expect(update).toBeTypeOf("function");
  });
});
