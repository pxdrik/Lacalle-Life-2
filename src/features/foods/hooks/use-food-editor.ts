"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import type { EntityId } from "@/core/domain/entity";

import { useFoodRepository } from "../data/food-repository-context";
import { createCustomFood, updateCustomFood } from "../services/create-food";
import type { Food } from "../types/food";
import type { CustomFoodInput } from "../validation/food-schema";

export type FoodEditorState =
  | { readonly status: "loading" }
  /** Creating, or editing a food that loaded. `food` is null when creating. */
  | { readonly status: "ready"; readonly food: Food | null }
  | { readonly status: "missing" }
  | { readonly status: "error"; readonly message: string };

export interface FoodEditor {
  readonly state: FoodEditorState;
  readonly save: (input: CustomFoodInput) => Promise<boolean>;
  readonly pending: boolean;
  readonly error: string | null;
}

/**
 * The write side of a custom food, for both creating one and correcting one.
 *
 * One hook rather than two because the difference between the two screens is a
 * single branch — mint an id or keep the one that exists — while the loading,
 * pending and error plumbing is identical. Two hooks would have meant two
 * places to fix the next bug in that plumbing.
 *
 * Editing existed nowhere before this: a mistyped protein value could only be
 * deleted and retyped from scratch, which also broke every diet already
 * pointing at that food.
 *
 * Deliberately does not load the whole catalogue. This screen writes one row;
 * reading 216 to do it would be work done for nothing.
 */
export function useFoodEditor(id: EntityId | null): FoodEditor {
  const repository = useFoodRepository();
  const [state, setState] = useState<FoodEditorState>(
    id === null ? { status: "ready", food: null } : { status: "loading" },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null) return;

    // Captured so the closure below narrows without an assertion.
    const wanted = id;
    let active = true;

    async function load() {
      try {
        const food = await (await repository).getById(wanted);
        if (!active) return;

        // A catalogue entry is not editable: its values are curated and a
        // future revision of the catalogue would overwrite the change anyway.
        setState(
          food === undefined || !food.isCustom
            ? { status: "missing" }
            : { status: "ready", food },
        );
      } catch (cause) {
        if (active) setState({ status: "error", message: describeDataError(cause) });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository, id]);

  const save = useCallback(
    async (input: CustomFoodInput): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        const existing = state.status === "ready" ? state.food : null;

        await (await repository).save(
          existing === null
            ? createCustomFood(input)
            : updateCustomFood(existing, input),
        );
        return true;
      } catch (cause) {
        setError(describeDataError(cause));
        return false;
      } finally {
        setPending(false);
      }
    },
    [repository, state],
  );

  return { state, save, pending, error };
}
