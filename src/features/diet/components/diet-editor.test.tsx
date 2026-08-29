import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

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

/** Opens the picker and adds the one food the harness knows about. */
async function addChicken() {
  await userEvent.click(
    screen.getByRole("button", { name: "Adicionar alimento" }),
  );
  await userEvent.type(
    screen.getByLabelText("Buscar alimento para adicionar"),
    "frango",
  );
  await userEvent.click(
    await screen.findByRole("button", { name: /Peito de frango/ }),
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
      screen.getByRole("button", { name: "Excluir Refeição 1" }),
    );

    expect(screen.getByLabelText("Nome da refeição")).toBeInTheDocument();
  });

  it("removes a meal once the deletion is confirmed", async () => {
    const diet = createDiet("Cutting");
    const { diets } = mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");

    await userEvent.click(
      screen.getByRole("button", { name: "Excluir Refeição 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Excluir?: Excluir Refeição 1" }),
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
    const { diets } = mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");

    await addChicken();

    expect(
      screen.getByLabelText("Quantidade de Peito de frango grelhado"),
    ).toHaveValue("100");
    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals[0]?.items).toHaveLength(1);
    });
  });

  it("shows the portion's contribution", async () => {
    const diet = createDiet("Cutting");
    mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");

    await addChicken();

    // 100 g of chicken is 165 kcal, in the meal header and in the page total.
    await waitFor(() => {
      expect(screen.getAllByText("165").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("recomputes when the portion changes", async () => {
    const diet = createDiet("Cutting");
    mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");
    await addChicken();

    const grams = screen.getByLabelText("Quantidade de Peito de frango grelhado");
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
    const { diets } = mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");
    await addChicken();

    await userEvent.click(
      screen.getByRole("button", { name: "Remover Peito de frango grelhado" }),
    );

    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals[0]?.items).toHaveLength(0);
    });
  });

  it("copies the food's values, so correcting the catalogue cannot rewrite the diet", async () => {
    const diet = createDiet("Cutting");
    const { diets, foods } = mount(diet.id, diet);
    await screen.findByLabelText("Nome da dieta");
    await addChicken();

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

describe("sending an item to another diet", () => {
  /** Seeds two diets, so `useDietList` has somewhere else to send food to. */
  function mountWithTargetDiet() {
    const diet = createDiet("Cutting");
    const target = createDiet("Bulking");

    const diets = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
    const foods = new LocalFoodRepository(new MemoryStore<Food>(FOODS_STORE));

    const ready = Promise.all([
      diets.save(diet, null),
      diets.save(target, null),
      foods.save(CHICKEN, null),
    ]);

    render(
      <DietRepositoryProvider repository={ready.then(() => diets)}>
        <FoodRepositoryProvider repository={ready.then(() => foods)}>
          <DietEditor dietId={diet.id} />
        </FoodRepositoryProvider>
      </DietRepositoryProvider>,
    );

    return { diet, target, diets };
  }

  it("copies the item into the target diet's meal, keeping the original", async () => {
    const { diet, target, diets } = mountWithTargetDiet();
    await screen.findByLabelText("Nome da dieta");
    await addChicken();

    // Both diets' default meal is named "Refeição 1", and this diet has no
    // *other* meal of its own to move within — so the only two options on
    // screen read the same text, one to move and one to copy. Reached by
    // value instead of the ambiguous label.
    const select = await screen.findByLabelText(
      "Mover ou copiar Peito de frango grelhado para outra refeição",
    );
    fireEvent.change(select, {
      target: { value: `copy:${target.id}:${target.meals[0]!.id}` },
    });

    await waitFor(async () => {
      expect((await diets.getById(target.id))?.meals[0]?.items).toHaveLength(
        1,
      );
    });
    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals[0]?.items).toHaveLength(1);
    });
  });

  it("moves the item into the target diet's meal, removing the original", async () => {
    const { diet, target, diets } = mountWithTargetDiet();
    await screen.findByLabelText("Nome da dieta");
    await addChicken();

    const select = await screen.findByLabelText(
      "Mover ou copiar Peito de frango grelhado para outra refeição",
    );
    fireEvent.change(select, { target: { value: `move:${target.id}:${target.meals[0]!.id}` } });

    await waitFor(async () => {
      expect((await diets.getById(target.id))?.meals[0]?.items).toHaveLength(
        1,
      );
    });
    await waitFor(async () => {
      expect((await diets.getById(diet.id))?.meals[0]?.items).toHaveLength(0);
    });
  });

  it("groups the target diet's meals under its own name, separate from this diet's", async () => {
    mountWithTargetDiet();
    await screen.findByLabelText("Nome da dieta");
    await addChicken();

    const select = await screen.findByLabelText(
      "Mover ou copiar Peito de frango grelhado para outra refeição",
    );
    // `optgroup`'s `label` is an attribute, not text content, so it has to
    // be read off the element rather than asserted with `toHaveTextContent`.
    const labels = [...select.querySelectorAll("optgroup")].map((group) =>
      group.getAttribute("label"),
    );
    expect(labels).toContain("Mover para · Bulking");
    expect(labels).toContain("Copiar para · Bulking");
  });
});
