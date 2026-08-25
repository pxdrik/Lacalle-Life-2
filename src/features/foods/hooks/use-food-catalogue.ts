"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import { revise } from "@/core/domain/entity";

import { useFoodRepository } from "../data/food-repository-context";
import type { Food } from "../types/food";

/**
 * Illegal states are unrepresentable: there is no way to hold foods *and* a
 * load error, or to be loading *and* ready.
 */
export type FoodCatalogueState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly foods: readonly Food[] }
  | { readonly status: "error"; readonly message: string };

export interface FoodCatalogue {
  readonly state: FoodCatalogueState;
  /** Set when a write failed. Reading still works; the list is unchanged. */
  readonly writeError: string | null;
  readonly toggleFavorite: (food: Food) => Promise<void>;
  readonly removeFood: (food: Food) => Promise<void>;
}

/**
 * Loads the whole catalogue once, after mount, and owns writes to it.
 *
 * All of it, deliberately. A few hundred rows is a single ~2 ms read, and
 * holding them in memory is what lets search filter without touching storage
 * again — no debounce, no per-keystroke query, no spinner.
 *
 * After mount rather than during render because local storage does not exist
 * on the server, and this app's data has no server representation to
 * prerender.
 */
export function useFoodCatalogue(): FoodCatalogue {
  const repository = useFoodRepository();
  const [state, setState] = useState<FoodCatalogueState>({ status: "loading" });
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const foods = await (await repository).listAll();
        if (active) setState({ status: "ready", foods });
      } catch (error) {
        if (active) {
          setState({ status: "error", message: describeDataError(error) });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  /**
   * Storage is written first, then state. Local writes land in about a
   * millisecond, so there is nothing for an optimistic update to hide — and
   * this way the list can never show something that failed to save.
   *
   * The state update is a pure function of the previous state, so React is
   * free to call it twice.
   */
  const toggleFavorite = useCallback(
    async (food: Food) => {
      setWriteError(null);
      const updated = revise(food, { isFavorite: !food.isFavorite });

      try {
        await (await repository).save(updated, food.updatedAt);
        setState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                foods: current.foods.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              }
            : current,
        );
      } catch (error) {
        setWriteError(describeDataError(error));
      }
    },
    [repository],
  );

  const removeFood = useCallback(
    async (food: Food) => {
      setWriteError(null);

      try {
        await (await repository).remove(food.id);
        setState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                foods: current.foods.filter((item) => item.id !== food.id),
              }
            : current,
        );
      } catch (error) {
        setWriteError(describeDataError(error));
      }
    },
    [repository],
  );

  return { state, writeError, toggleFavorite, removeFood };
}
