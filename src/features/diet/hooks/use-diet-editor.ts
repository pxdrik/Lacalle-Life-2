"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import type { EntityId } from "@/core/domain/entity";

import { useDietRepository } from "../data/diet-repository-context";
import type { Diet } from "../types/diet";

export type DietEditorState =
  | { readonly status: "loading" }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly diet: Diet }
  | { readonly status: "error"; readonly message: string };

export interface DietEditor {
  readonly state: DietEditorState;
  /** Set when a save failed. The edit stays on screen; it is just not stored. */
  readonly saveError: string | null;
  /** Applies a pure edit and persists the result. */
  readonly apply: (change: (diet: Diet) => Diet) => void;
}

/**
 * Loads one diet and persists every edit to it.
 *
 * Writes go out on each change with no debounce. A diet document is a few
 * kilobytes and a local write costs about a millisecond, so batching would
 * only add a window in which someone can close the tab and lose work.
 */
export function useDietEditor(dietId: EntityId): DietEditor {
  const repository = useDietRepository();
  const [state, setState] = useState<DietEditorState>({ status: "loading" });
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const diet = await (await repository).getById(dietId);
        if (!active) return;
        setState(
          diet === undefined
            ? { status: "missing" }
            : { status: "ready", diet },
        );
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
  }, [repository, dietId]);

  /**
   * The screen updates first, then storage.
   *
   * The opposite order is right for a single toggle, where a silent revert is
   * confusing. Here it would mean every keystroke in a meal name waits on a
   * transaction — and an editor that stutters while you type is a broken
   * editor. A failed save surfaces as a banner without discarding the edit.
   */
  /**
   * The functional form of `setState` matters beyond convention here: when
   * several `apply()` calls land in the same batch, each updater sees the
   * previous updater's result as `prevState`, not the stale value this
   * closure closed over — that is what makes same-tick edits compose instead
   * of the last one silently winning. The version passed to `save` is exactly
   * the version the updater it grew out of actually read.
   */
  const apply = useCallback(
    (change: (diet: Diet) => Diet) => {
      setState((prevState) => {
        if (prevState.status !== "ready") return prevState;

        const next = change(prevState.diet);
        // Edits addressing a meal or item that is no longer there return the
        // same diet. Nothing to store, nothing to re-render.
        if (next === prevState.diet) return prevState;

        void persist(next, prevState.diet.updatedAt);
        return { status: "ready", diet: next };
      });

      async function persist(diet: Diet, expectedUpdatedAt: number) {
        setSaveError(null);
        try {
          await (await repository).save(diet, expectedUpdatedAt);
        } catch (error) {
          setSaveError(describeDataError(error));
        }
      }
    },
    [repository],
  );

  return { state, saveError, apply };
}
