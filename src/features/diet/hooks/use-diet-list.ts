"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";

import { useDietRepository } from "../data/diet-repository-context";
import { createDiet, duplicateDiet } from "../services/create-diet";
import type { Diet } from "../types/diet";

export type DietListState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly diets: readonly Diet[] }
  | { readonly status: "error"; readonly message: string };

export interface DietList {
  readonly state: DietListState;
  readonly writeError: string | null;
  /** Resolves to the new diet's id so the caller can navigate straight into it. */
  readonly create: (name: string) => Promise<string | null>;
  /** Copies a whole diet. Stays on the list — you copied it to keep both. */
  readonly duplicate: (diet: Diet) => Promise<void>;
  readonly remove: (diet: Diet) => Promise<void>;
}

export function useDietList(): DietList {
  const repository = useDietRepository();
  const [state, setState] = useState<DietListState>({ status: "loading" });
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const diets = await (await repository).listAll();
        if (active) setState({ status: "ready", diets });
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

  const create = useCallback(
    async (name: string): Promise<string | null> => {
      setWriteError(null);
      const diet = createDiet(name);

      try {
        await (await repository).save(diet);
        setState((current) =>
          current.status === "ready"
            ? { status: "ready", diets: [diet, ...current.diets] }
            : current,
        );
        return diet.id;
      } catch (error) {
        setWriteError(describeDataError(error));
        return null;
      }
    },
    [repository],
  );

  const duplicate = useCallback(
    async (diet: Diet) => {
      setWriteError(null);
      const copy = duplicateDiet(diet);

      try {
        await (await repository).save(copy);
        setState((current) =>
          current.status === "ready"
            ? { status: "ready", diets: [copy, ...current.diets] }
            : current,
        );
      } catch (error) {
        setWriteError(describeDataError(error));
      }
    },
    [repository],
  );

  const remove = useCallback(
    async (diet: Diet) => {
      setWriteError(null);

      try {
        await (await repository).remove(diet.id);
        setState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                diets: current.diets.filter((item) => item.id !== diet.id),
              }
            : current,
        );
      } catch (error) {
        setWriteError(describeDataError(error));
      }
    },
    [repository],
  );

  return { state, writeError, create, duplicate, remove };
}
