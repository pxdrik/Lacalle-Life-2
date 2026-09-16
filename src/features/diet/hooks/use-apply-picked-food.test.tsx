import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";
import type { Food } from "@/features/foods";

import { createMeal } from "../services/create-diet";
import type { FoodLog } from "../types/food-log";
import { useApplyPickedFood } from "./use-apply-picked-food";

const mockSearchParams = vi.fn(() => new URLSearchParams());
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn() }),
  useSearchParams: () => mockSearchParams(),
  usePathname: () => "/diario",
}));

beforeEach(() => {
  mockSearchParams.mockReturnValue(new URLSearchParams());
  mockReplace.mockClear();
});

const CHICKEN: Food = {
  id: "peito-de-frango",
  name: "Peito de frango",
  category: "protein",
  per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  isCustom: false,
  isFavorite: false,
  createdAt: 1,
  updatedAt: 1,
};

function emptyLog(mealId: string): FoodLog {
  return {
    id: "2026-09-17",
    day: "2026-09-17",
    dietId: null,
    meals: [{ ...createMeal(1), id: mealId }],
    createdAt: 1,
    updatedAt: 1,
  };
}

/** Renders the hook against a real `useFoodCatalogue()`, seeded with `CHICKEN`. */
function Probe({
  apply,
}: {
  readonly apply: (change: (current: FoodLog) => FoodLog) => void;
}) {
  useApplyPickedFood(apply);
  return <span data-testid="rendered" />;
}

function mount(apply: (change: (current: FoodLog) => FoodLog) => void) {
  const repository = new LocalFoodRepository(
    new MemoryStore<Food>(FOODS_STORE),
  );

  return render(
    <FoodRepositoryProvider
      repository={repository.save(CHICKEN, null).then(() => repository)}
    >
      <Probe apply={apply} />
    </FoodRepositoryProvider>,
  );
}

describe("useApplyPickedFood", () => {
  it("does nothing when the URL carries no add* params", async () => {
    const apply = vi.fn();
    mount(apply);

    await screen.findByTestId("rendered");
    // Nothing to wait for succeeding — give the catalogue's async load a
    // turn, then confirm apply was never reached for it.
    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("adds the picked food once the catalogue is ready, then clears the URL", async () => {
    const mealId = "m1";
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        addFoodId: CHICKEN.id,
        addMealId: mealId,
        addGrams: "150",
      }),
    );
    const log = emptyLog(mealId);
    const apply = vi.fn((change: (current: FoodLog) => FoodLog) => change(log));

    mount(apply);

    await waitFor(() => {
      expect(apply).toHaveBeenCalledTimes(1);
    });

    const result = apply.mock.results[0]?.value as FoodLog;
    expect(result.meals[0]?.items).toHaveLength(1);
    expect(result.meals[0]?.items[0]).toMatchObject({
      name: "Peito de frango",
      grams: 150,
    });
    expect(mockReplace).toHaveBeenCalledWith("/diario");
  });
});
