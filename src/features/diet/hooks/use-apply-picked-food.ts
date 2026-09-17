"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useFoodCatalogue } from "@/features/foods";

import { createMealItem } from "../services/create-diet";
import { addItem } from "../services/edit-diet";
import type { MealOwner } from "../types/diet";

/**
 * Picks up what `/alimentos/selecionar` (17/09/2026) left in the URL — the
 * food, the meal, the grams — and applies it the same way the old inline
 * picker did: `createMealItem` + `addItem`, nothing new about the write
 * itself, only where the choice was made.
 *
 * The URL is the hand-off, not a global store: the picker page navigates
 * back with `addFoodId`/`addMealId`/`addGrams` on whatever `returnTo` it was
 * given, and this reads them once the catalogue is loaded (the food has to
 * be looked up by id — a whole `Food` never travels through query params).
 * Cleared with `router.replace` right after, whether or not the lookup
 * succeeded, so a refresh or a browser-back never re-applies it, and a
 * garbled param never loops.
 *
 * **The `appliedRef` guard is load-bearing, not defensive padding.**
 * `router.replace` is what clears the params in a real browser — but this
 * effect depends on `router` itself, and nothing here guarantees that
 * object is referentially stable across renders. Found live, 17/09/2026: it
 * is not stable in the test harness's `useRouter` mock (`() => ({ push:
 * vi.fn(), ... })` builds a fresh object every call), so every unrelated
 * re-render of the screen re-ran this effect while the still-mocked
 * `useSearchParams()` kept returning the same, never-actually-cleared
 * params — adding the same food again on every render until something else
 * changed. Whether or not the real Next.js router happens to memoize its
 * own object today, depending on that is exactly the kind of assumption
 * that breaks quietly on a version bump; the guard makes correctness not
 * depend on it.
 *
 * Shared by `DietEditor` and `FoodLogScreen` because `MealOwner` already
 * covers both — one hook, not two near-identical effects.
 */
export function useApplyPickedFood<T extends MealOwner>(
  apply: (change: (current: T) => T) => void,
): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useFoodCatalogue();
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    const foodId = searchParams.get("addFoodId");
    const mealId = searchParams.get("addMealId");
    const gramsRaw = searchParams.get("addGrams");
    if (foodId === null || mealId === null || gramsRaw === null) return;
    if (state.status !== "ready") return;

    const instruction = `${foodId}|${mealId}|${gramsRaw}`;
    if (appliedRef.current === instruction) return;
    appliedRef.current = instruction;

    const food = state.foods.find((item) => item.id === foodId);
    const grams = Number(gramsRaw);

    if (food !== undefined && Number.isFinite(grams) && grams > 0) {
      apply((current) =>
        addItem(
          current,
          mealId,
          createMealItem({
            foodId: food.id,
            name: food.name,
            grams,
            unit: food.unit,
            per100g: food.per100g,
            practicalUnit: food.practicalUnit,
          }),
        ),
      );
    }

    const next = new URLSearchParams(searchParams);
    next.delete("addFoodId");
    next.delete("addMealId");
    next.delete("addGrams");
    const query = next.toString();
    router.replace(query === "" ? pathname : `${pathname}?${query}`);
  }, [apply, pathname, router, searchParams, state]);
}
