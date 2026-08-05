"use client";

import { useCallback, useState } from "react";

import { useFoodRepository } from "../data/food-repository-context";
import { createCustomFood } from "../services/create-food";
import { describeDataError } from "../services/describe-data-error";
import type { CustomFoodInput } from "../validation/food-schema";

export interface CreateFood {
  readonly save: (input: CustomFoodInput) => Promise<boolean>;
  readonly pending: boolean;
  readonly error: string | null;
}

/**
 * Creates a user's own food.
 *
 * Separate from `useFoodCatalogue` because the create screen is its own route
 * and has no list to hold — loading 216 rows to write one would be work done
 * for nothing.
 *
 * Resolves `true` on success so the caller can navigate away, and `false`
 * when the write failed, in which case `error` explains why and the form
 * keeps what the user typed.
 */
export function useCreateFood(): CreateFood {
  const repository = useFoodRepository();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (input: CustomFoodInput): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await (await repository).save(createCustomFood(input));
        return true;
      } catch (cause) {
        setError(describeDataError(cause));
        return false;
      } finally {
        setPending(false);
      }
    },
    [repository],
  );

  return { save, pending, error };
}
