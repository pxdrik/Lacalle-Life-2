"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";

import { useDietRepository } from "../data/diet-repository-context";
import { createDiet, duplicateDiet } from "../services/create-diet";
import { assignWeekdays } from "../services/diet-schedule";
import type { Diet, Weekday } from "../types/diet";

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
  /** Links `dietId` to exactly these weekdays, unlinking them from any other diet. */
  readonly setWeekdays: (dietId: string, weekdays: readonly Weekday[]) => Promise<void>;
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
        await (await repository).save(diet, null);
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
        await (await repository).save(copy, null);
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

  const setWeekdays = useCallback(
    async (dietId: string, weekdays: readonly Weekday[]) => {
      if (state.status !== "ready") return;
      const diets = state.diets;
      setWriteError(null);

      const next = assignWeekdays(diets, dietId, weekdays);
      // `assignWeekdays` returns the same reference for every diet it left
      // untouched, so this only ever writes the ones that actually moved —
      // usually one or two, never the whole list.
      const changed = next.filter((diet, index) => diet !== diets[index]);
      if (changed.length === 0) return;

      try {
        const repo = await repository;
        await Promise.all(
          changed.map((diet) => {
            const previous = diets.find((item) => item.id === diet.id);
            return repo.save(diet, previous?.updatedAt ?? null);
          }),
        );
        setState({ status: "ready", diets: next });
      } catch (error) {
        setWriteError(describeDataError(error));
      }
    },
    [repository, state],
  );

  return { state, writeError, create, duplicate, remove, setWeekdays };
}
