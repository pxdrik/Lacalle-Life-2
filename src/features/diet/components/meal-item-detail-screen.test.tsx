import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { dayKey } from "@/core/format/day";
import { MemoryStore } from "@/core/storage/memory-store";

import { FOOD_LOGS_STORE } from "../data/food-log-repository";
import { FoodLogRepositoryProvider } from "../data/food-log-repository-context";
import { LocalFoodLogRepository } from "../data/local-food-log-repository";
import type { FoodLog } from "../types/food-log";
import { MealItemDetailScreen } from "./meal-item-detail-screen";

const TODAY = dayKey(new Date());

let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentParams,
}));

function logWithItem(): FoodLog {
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

function mount(seed: FoodLog, params: Record<string, string>) {
  currentParams = new URLSearchParams(params);
  const logs = new LocalFoodLogRepository(
    new MemoryStore<FoodLog>(FOOD_LOGS_STORE),
  );
  const ready = logs.save(seed, null);

  render(
    <FoodLogRepositoryProvider repository={ready.then(() => logs)}>
      <MealItemDetailScreen />
    </FoodLogRepositoryProvider>,
  );

  return logs;
}

describe("MealItemDetailScreen", () => {
  it("shows the food's name, meal, portion and macros", async () => {
    mount(logWithItem(), { dia: TODAY, mealId: "m1", itemId: "i1" });

    expect(
      await screen.findByRole("heading", { name: "Ovo inteiro" }),
    ).toBeInTheDocument();
    // "Café da manhã", a data e "100 g" são nós de texto separados dentro do
    // mesmo parágrafo — conferidos pelo textContent do parágrafo inteiro, não
    // por um único nó, já que o JSX intercala expressões e texto literal.
    const meta = screen.getByText(/Café da manhã/).closest("p");
    expect(meta?.textContent).toContain("100");
    expect(meta?.textContent).toContain("g");
    // kcal do MacroSummary, escalado por 100 g: 143 kcal por 100 g × 100 g.
    expect(screen.getByText("143")).toBeInTheDocument();
  });

  it("shows every optional nutrient as blank, not zero, when none was ever informed", async () => {
    mount(logWithItem(), { dia: TODAY, mealId: "m1", itemId: "i1" });
    await screen.findByRole("heading", { name: "Ovo inteiro" });

    const fields = screen.getAllByPlaceholderText("Não informado");
    // Marca + os 4 nutrientes.
    expect(fields).toHaveLength(5);
    for (const field of fields) expect(field).toHaveValue("");
  });

  it("saves a typed nutrient value, persisted to the log", async () => {
    const logs = mount(logWithItem(), {
      dia: TODAY,
      mealId: "m1",
      itemId: "i1",
    });
    await screen.findByRole("heading", { name: "Ovo inteiro" });

    const sodium = screen.getByLabelText(/Sódio/);
    await userEvent.type(sodium, "62");

    await waitFor(async () => {
      const stored = await logs.getByDay(TODAY);
      expect(stored?.meals[0]?.items[0]?.sodiumMg).toBe(62);
    });
  });

  it("never writes a silent zero for a field left blank", async () => {
    const logs = mount(logWithItem(), {
      dia: TODAY,
      mealId: "m1",
      itemId: "i1",
    });
    await screen.findByRole("heading", { name: "Ovo inteiro" });

    // Nada digitado nos opcionais — só confirma que o registro salvo, se
    // algum outro campo disparar uma escrita, continua sem os 4 campos.
    const brand = screen.getByLabelText(/Marca/);
    await userEvent.type(brand, "Granja X");
    await userEvent.tab();

    await waitFor(async () => {
      const stored = await logs.getByDay(TODAY);
      const item = stored?.meals[0]?.items[0];
      expect(item?.brand).toBe("Granja X");
      expect(item?.sodiumMg).toBeUndefined();
      expect(item?.saturatedFatG).toBeUndefined();
      expect(item?.fiberG).toBeUndefined();
      expect(item?.sugarG).toBeUndefined();
    });
  });

  it("shows a not-found notice, with a way back, when the item is gone", async () => {
    mount(logWithItem(), { dia: TODAY, mealId: "m1", itemId: "gone" });

    expect(
      await screen.findByText("Este alimento não está mais aqui."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Diário/ })).toBeInTheDocument();
  });
});
