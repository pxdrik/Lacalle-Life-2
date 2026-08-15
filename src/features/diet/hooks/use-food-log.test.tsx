import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { FOOD_LOGS_STORE } from "../data/food-log-repository";
import { FoodLogRepositoryProvider } from "../data/food-log-repository-context";
import { LocalFoodLogRepository } from "../data/local-food-log-repository";
import { addMeal, updateMeal } from "../services/edit-diet";
import type { FoodLog } from "../types/food-log";
import { useFoodLogDay } from "./use-food-log";

/**
 * The layer that decides what reaches storage.
 *
 * The services are pure and well covered, and the components are rendered and
 * checked. This is the seam between them — the code that chooses whether to
 * `save` or to `remove` — and it had no test at all. Both of the diary bugs
 * this file guards lived exactly here: the pieces were verified and the
 * assembly was not.
 */

const DAY = "2026-08-14";

function Probe({ act }: { readonly act: (log: FoodLog) => FoodLog }) {
  const { state, apply } = useFoodLogDay(DAY);

  if (state.status !== "ready") return <span data-testid="state">loading</span>;

  return (
    <button
      data-testid="state"
      type="button"
      onClick={() => {
        apply(act);
      }}
    >
      {state.log.meals.length}
    </button>
  );
}

async function mount(act: (log: FoodLog) => FoodLog) {
  const store = new MemoryStore<FoodLog>(FOOD_LOGS_STORE);
  const repository = new LocalFoodLogRepository(store);

  render(
    <FoodLogRepositoryProvider repository={Promise.resolve(repository)}>
      <Probe act={act} />
    </FoodLogRepositoryProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId("state").textContent).toBe("0");
  });

  return repository;
}

describe("useFoodLogDay", () => {
  it("writes a meal that has no food in it yet", async () => {
    // The regression, end to end. Before this, `isEmptyLog` called a day with
    // meals and no items empty, so `persist` deleted the record instead of
    // saving it: the meal was on screen and nowhere else, and a reload said
    // "Nada registrado".
    const repository = await mount((log) => addMeal(log));

    screen.getByTestId("state").click();

    await waitFor(async () => {
      const stored = await repository.getByDay(DAY);
      expect(stored?.meals).toHaveLength(1);
    });
  });

  it("keeps the name typed into a meal with no food", async () => {
    // The part that actually hurt: the name, the time and the notes are work,
    // and they were the first thing lost.
    const repository = await mount((log) => {
      const withMeal = addMeal(log);
      return updateMeal(withMeal, withMeal.meals[0]!.id, {
        name: "Café da manhã",
        notes: "Antes do treino",
      });
    });

    screen.getByTestId("state").click();

    await waitFor(async () => {
      const stored = await repository.getByDay(DAY);
      expect(stored?.meals[0]?.name).toBe("Café da manhã");
    });
  });

  it("still deletes a day left with no meals at all", async () => {
    // The rule that was right and has to survive: an untouched day is not a
    // logged day, and storing it would put a zero on a chart where the truth
    // is "no record".
    const store = new MemoryStore<FoodLog>(FOOD_LOGS_STORE);
    const repository = new LocalFoodLogRepository(store);

    await repository.save({
      id: DAY,
      day: DAY,
      dietId: null,
      createdAt: 1,
      updatedAt: 1,
      meals: [
        { id: "m1", name: "Almoço", time: null, notes: "", items: [] },
      ],
    });

    render(
      <FoodLogRepositoryProvider repository={Promise.resolve(repository)}>
        <Probe act={(log) => ({ ...log, meals: [] })} />
      </FoodLogRepositoryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("1");
    });

    screen.getByTestId("state").click();

    await waitFor(async () => {
      expect(await repository.getByDay(DAY)).toBeUndefined();
    });
  });
});
