import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";
import type { Food } from "@/features/foods";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { DIETS_STORE } from "../data/diet-store";
import { LocalDietRepository } from "../data/local-diet-repository";
import { createDiet } from "../services/create-diet";
import type { Diet } from "../types/diet";
import { DietEditor } from "./diet-editor";

// "Adicionar alimento" agora navega para `/alimentos/selecionar` (17/09/2026)
// em vez de abrir um painel inline — `useSearchParams` precisa de um mock
// controlável por teste porque `useApplyPickedFood` é o que consome
// `addFoodId`/`addMealId`/`addGrams` de volta, o mesmo jeito que a tela real
// receberia depois de voltar da nova página.
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => mockSearchParams(),
  usePathname: () => "/dietas/test",
}));

beforeEach(() => {
  mockSearchParams.mockReturnValue(new URLSearchParams());
});

/**
 * The whole vertical slice, against in-memory repositories.
 *
 * This is where the pieces meet: a click has to become a pure edit, a write,
 * and a recomputed total. The services are unit tested; what this proves is
 * that they are wired to each other and to the screen.
 */

const CHICKEN: Food = {
  id: "peito-de-frango-grelhado",
  name: "Peito de frango grelhado",
  category: "protein",
  unit: "g",
  per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  isCustom: false,
  isFavorite: false,
  createdAt: 1,
  updatedAt: 1,
};

interface Harness {
  readonly diets: LocalDietRepository;
  readonly foods: LocalFoodRepository;
}

function mount(dietId: string, seed?: Diet): Harness {
  const diets = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const foods = new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));

  const ready = Promise.all([
    seed === undefined ? Promise.resolve() : diets.save(seed, null),
    foods.save(CHICKEN, null),
  ]);

  render(
    <DietRepositoryProvider repository={ready.then(() => diets)}>
      <FoodRepositoryProvider repository={ready.then(() => foods)}>
        <DietEditor dietId={dietId} />
      </FoodRepositoryProvider>
    </DietRepositoryProvider>,
  );

  return { diets, foods };
}

/**
 * Simulates arriving back from `/alimentos/selecionar` with the chicken
 * picked at 100 g — set before `mount()`, matching the real navigation: the
 * params are already on the URL the moment `DietEditor` mounts, not added to
 * an already-open screen.
 */
function returningWithChicken(mealId: string) {
  mockSearchParams.mockReturnValue(
    new URLSearchParams({
      addFoodId: CHICKEN.id,
      addMealId: mealId,
      addGrams: "100",
    }),
  );
}

describe("DietEditor", () => {
  it("works with no profile feature wired in at all", async () => {
    // The harness mounts diet and food repositories only — no profile
    // provider. Building a diet must never depend on the profile feature
    // being present, so this test deliberately omits it.
    const diet = createDiet("Cutting");
    mount(diet.id, diet);

    expect(await screen.findByLabelText("Nome da dieta")).toHaveValue(
      "Cutting",
    );
  });

  it("reports a diet that does not exist, rather than showing an empty one", async () => {
    mount("nunca-existiu");

    expect(
      await screen.findByText("Esta dieta não existe."),
    ).toBeInTheDocument();
  });

  it("loads the diet's name and its meal", async () => {
    const diet = createDiet("Cutting");
    mount(diet.id, diet);

    expect(await screen.findByLabelText("Nome da dieta")).toHaveValue(
      "Cutting",
    );
    expect(screen.getByLabelText("Nome da refeição")).toHaveValue("Refeição 1");
  });

  it("persists a rename", async () => {
    const diet = createDiet("Cutting");
    const { diets } = mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");

    await userEvent.type(screen.getByLabelText("Nome da dieta"), " agressivo");

    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.name).toBe("Cutting agressivo");
    });
  });

  it("adds a meal", async () => {
    const diet = createDiet("Cutting");
    mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");

    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar refeição" }),
    );

    expect(screen.getAllByLabelText("Nome da refeição")).toHaveLength(2);
  });

  it("does not remove a meal on a single tap", async () => {
    // Deleting a meal takes its foods with it and cannot be undone, so the
    // button asks before it acts.
    const diet = createDiet("Cutting");
    mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");

    await userEvent.click(
      screen.getByRole("button", { name: "Mais ações para Refeição 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Excluir Refeição 1" }),
    );

    expect(screen.getByLabelText("Nome da refeição")).toBeInTheDocument();
  });

  it("removes a meal once the deletion is confirmed", async () => {
    const diet = createDiet("Cutting");
    const { diets } = mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");

    await userEvent.click(
      screen.getByRole("button", { name: "Mais ações para Refeição 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Excluir Refeição 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Excluir?: Excluir Refeição 1" }),
    );

    // Delete/Collapse: confirming only starts the shrink; the name field
    // stays until the card's own collapse transition ends.
    fireEvent.transitionEnd(
      screen
        .getByRole("button", { name: "Mais ações para Refeição 1" })
        .closest(".grid")!,
      { propertyName: "grid-template-rows" },
    );

    expect(screen.queryByLabelText("Nome da refeição")).not.toBeInTheDocument();
    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals).toHaveLength(0);
    });
  });

  it("keeps 'no fixed time' distinct from midnight", async () => {
    const diet = createDiet("Cutting");
    const { diets } = mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");

    const time = screen.getByLabelText("Horário de Refeição 1");
    expect(time).toHaveValue("");

    await userEvent.type(time, "07:30");

    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals[0]?.time).toBe("07:30");
    });
  });
});

describe("adding food", () => {
  it("adds at 100 g, the unit the catalogue is stated in", async () => {
    const diet = createDiet("Cutting");
    returningWithChicken(diet.meals[0]!.id);
    const { diets } = mount(diet.id, diet);

    expect(
      await screen.findByLabelText("Quantidade de Peito de frango grelhado"),
    ).toHaveValue("100");
    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals[0]?.items).toHaveLength(1);
    });
  });

  it("shows the portion's contribution", async () => {
    const diet = createDiet("Cutting");
    returningWithChicken(diet.meals[0]!.id);
    mount(diet.id, diet);

    // 100 g of chicken is 165 kcal, in the meal header and in the page total.
    await waitFor(() => {
      expect(screen.getAllByText("165").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("recomputes when the portion changes", async () => {
    const diet = createDiet("Cutting");
    returningWithChicken(diet.meals[0]!.id);
    mount(diet.id, diet);

    const grams = await screen.findByLabelText(
      "Quantidade de Peito de frango grelhado",
    );
    await userEvent.clear(grams);
    await userEvent.type(grams, "200");

    // 200 g: 330 kcal and 62 g of protein.
    await waitFor(() => {
      expect(screen.getAllByText("330").length).toBeGreaterThan(0);
      expect(screen.getAllByText("62").length).toBeGreaterThan(0);
    });
  });

  it("removes an item", async () => {
    const diet = createDiet("Cutting");
    returningWithChicken(diet.meals[0]!.id);
    const { diets } = mount(diet.id, diet);

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Mais ações para Peito de frango grelhado",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remover Peito de frango grelhado" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Remover?: Remover Peito de frango grelhado",
      }),
    );

    // Delete/Collapse: confirming only starts the shrink; the store write
    // waits for the row's own collapse transition to finish.
    fireEvent.transitionEnd(
      screen
        .getByRole("button", { name: "Mais ações para Peito de frango grelhado" })
        .closest("li")!,
      { propertyName: "grid-template-rows" },
    );

    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals[0]?.items).toHaveLength(0);
    });
  });

  it("copies the food's values, so correcting the catalogue cannot rewrite the diet", async () => {
    const diet = createDiet("Cutting");
    returningWithChicken(diet.meals[0]!.id);
    const { diets, foods } = mount(diet.id, diet);

    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals[0]?.items).toHaveLength(1);
    });

    // The catalogue entry is corrected afterwards. The saved plan must not move.
    await foods.save(
      { ...CHICKEN, per100g: { ...CHICKEN.per100g, proteinG: 5 } },
      CHICKEN.updatedAt,
    );

    const stored = await diets.getById(diet.id);
    expect(stored?.meals[0]?.items[0]?.per100g.proteinG).toBe(31);
  });
});
