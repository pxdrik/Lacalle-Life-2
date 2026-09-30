import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createQuickItem, type QuickInput } from "../services/quick-item";
import type { Meal, MealItem } from "../types/diet";
import { MealCard } from "./meal-card";

/**
 * Registro rápido (roadmap 7.7, 30/09/2026), pelo card da refeição: a ação
 * no rodapé, a folha, o item "Avulso" e o total que avisa o que falta.
 */

const RICE: MealItem = {
  id: "arroz",
  foodId: "arroz",
  name: "Arroz",
  grams: 100,
  unit: "g",
  per100g: { kcal: 130, proteinG: 3, carbsG: 28, fatG: 0 },
};

function meal(items: readonly MealItem[]): Meal {
  return { id: "m1", name: "Almoço", time: null, notes: "", items };
}

function mount(
  theMeal: Meal,
  extra: {
    readonly onQuickLog?: (input: QuickInput) => void;
    readonly onEditQuickItem?: (itemId: string, input: QuickInput) => void;
    readonly onConsolidate?: (name: string, category: string) => void;
  } = {},
) {
  render(
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
      {...extra}
    />,
  );
}

describe("registrar", () => {
  it("a ação só existe onde o Diário a liga; a Dieta não tem", () => {
    mount(meal([]));
    expect(screen.queryByRole("button", { name: "Registro rápido" })).not.toBeInTheDocument();
  });

  it("calorias obrigatórias; macro em branco chega como null, não zero", async () => {
    const user = userEvent.setup();
    const onQuickLog = vi.fn();
    mount(meal([]), { onQuickLog });

    await user.click(screen.getByRole("button", { name: "Registro rápido" }));
    const sheet = screen.getByRole("dialog", { name: "Registro rápido no Almoço" });

    await user.click(within(sheet).getByRole("button", { name: "Registrar" }));
    expect(within(sheet).getByText("Informe as calorias.")).toBeInTheDocument();
    expect(onQuickLog).not.toHaveBeenCalled();

    await user.type(within(sheet).getByLabelText("Descrição (opcional)"), "Almoço no restaurante");
    await user.type(within(sheet).getByLabelText("Calorias"), "850");
    await user.type(within(sheet).getByLabelText("Prot. (g)"), "40");
    await user.click(within(sheet).getByRole("button", { name: "Registrar" }));

    expect(onQuickLog).toHaveBeenCalledExactlyOnceWith({
      name: "Almoço no restaurante",
      kcal: 850,
      proteinG: 40,
      carbsG: null,
      fatG: null,
    });
  });
});

describe("o item avulso na refeição", () => {
  const quick = createQuickItem({ name: "Almoço no restaurante", kcal: 850, proteinG: 40, carbsG: null, fatG: null });

  it("mostra Avulso no lugar das gramas e — no macro não informado", () => {
    mount(meal([quick]), { onQuickLog: vi.fn(), onEditQuickItem: vi.fn() });

    const row = screen.getByRole("button", { name: "Editar Almoço no restaurante" }).closest("li")!;
    expect(within(row).getByText("Avulso")).toBeInTheDocument();
    expect(within(row).queryByLabelText(/Quantidade de/)).not.toBeInTheDocument();
    expect(within(row).getAllByText("não informado")).toHaveLength(2);
  });

  it("o total soma o que se sabe, marca com * e diz o que falta", () => {
    mount(meal([RICE, quick]), { onQuickLog: vi.fn() });

    expect(screen.getAllByText(", incompleto")).toHaveLength(2);
    expect(screen.getByText("* Sem o carboidrato e a gordura de 1 item avulso.")).toBeInTheDocument();
  });

  it("editar abre a folha preenchida, com o branco em branco, e salva no mesmo item", async () => {
    const user = userEvent.setup();
    const onEditQuickItem = vi.fn();
    mount(meal([quick]), { onQuickLog: vi.fn(), onEditQuickItem });

    await user.click(screen.getByRole("button", { name: "Editar Almoço no restaurante" }));
    const sheet = screen.getByRole("dialog", { name: "Editar registro rápido" });
    expect(within(sheet).getByLabelText("Calorias")).toHaveValue("850");
    expect(within(sheet).getByLabelText("Carb. (g)")).toHaveValue("");

    await user.type(within(sheet).getByLabelText("Carb. (g)"), "95");
    await user.click(within(sheet).getByRole("button", { name: "Salvar" }));

    expect(onEditQuickItem).toHaveBeenCalledExactlyOnceWith(quick.id, {
      name: "Almoço no restaurante",
      kcal: 850,
      proteinG: 40,
      carbsG: 95,
      fatG: null,
    });
  });

  it("não oferece Transformar em 1 alimento: o avulso não tem gramas de verdade", async () => {
    const user = userEvent.setup();
    mount(meal([RICE, quick]), { onConsolidate: vi.fn() });

    await user.click(screen.getByRole("button", { name: "Mais ações para Almoço" }));
    expect(screen.queryByRole("button", { name: /Transformar em 1 alimento/ })).not.toBeInTheDocument();
  });
});
