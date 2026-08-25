"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DataError } from "@/core/domain/data-error";
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
  /**
   * `true` specifically when `saveError` came from `DataError("CONFLICT")` —
   * distinct from a `QUOTA_EXCEEDED` or `UNAVAILABLE` failure, which retrying
   * the exact same write might still recover from. A conflict never will:
   * `expectedUpdatedAt` is permanently stale until something re-reads the
   * diet, which is what `reload` is for.
   */
  readonly hasConflict: boolean;
  /** Applies a pure edit and persists the result. */
  readonly apply: (change: (diet: Diet) => Diet) => void;
  /**
   * Re-reads the diet from storage, replacing whatever is on screen.
   *
   * Before this existed, a losing tab's every `apply` after the first
   * conflict failed the same way, silently: `stateRef.current` kept the
   * locally-applied edit, so the next edit built on it and sent the same
   * stale `expectedUpdatedAt` right back. Nothing the person did in that tab
   * could ever be saved again short of a manual page reload. This is the
   * same recovery, offered as an explicit action instead — the person decides
   * when to give up their local edit and see the current version, rather
   * than it happening on their behalf or never happening at all.
   */
  readonly reload: () => void;
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
  const [hasConflict, setHasConflict] = useState(false);

  /**
   * Mirrors `state`, but written synchronously by `apply` itself rather than
   * read back from React's state. See the note on `apply` for why: reading
   * `state` there would be the same bug this replaced.
   */
  const stateRef = useRef(state);

  /**
   * Bumped by `reload` to re-run the effect below without adding a
   * `load`-the-function to its dependency array — an extracted `useCallback`
   * called from inside the effect is exactly the "setState inside an effect"
   * shape `react-hooks/set-state-in-effect` exists to flag, even though the
   * actual write only ever happens after the `await`. Keeping the fetch
   * inline in the effect, the way it was before `reload` existed, and giving
   * `reload` a token to depend on instead keeps the same effect shape while
   * still letting it re-run on demand.
   */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const diet = await (await repository).getById(dietId);
        if (!active) return;
        const next: DietEditorState =
          diet === undefined ? { status: "missing" } : { status: "ready", diet };
        stateRef.current = next;
        setState(next);
      } catch (error) {
        if (active) {
          const next: DietEditorState = {
            status: "error",
            message: describeDataError(error),
          };
          stateRef.current = next;
          setState(next);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository, dietId, reloadToken]);

  const reload = useCallback(() => {
    setSaveError(null);
    setHasConflict(false);
    const loadingState: DietEditorState = { status: "loading" };
    stateRef.current = loadingState;
    setState(loadingState);
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * The screen updates first, then storage.
   *
   * The opposite order is right for a single toggle, where a silent revert is
   * confusing. Here it would mean every keystroke in a meal name waits on a
   * transaction — and an editor that stutters while you type is a broken
   * editor. A failed save surfaces as a banner without discarding the edit.
   */
  /**
   * Reads and writes `stateRef` rather than using the functional form of
   * `setState`, on purpose — that used to be `setState((prevState) => {
   * ...; void persist(...); return next; })`, and it produced a real,
   * reproducible bug: the function passed to `setState` is a *render-phase*
   * function, and React Strict Mode (on here, `reactStrictMode: true` in
   * `next.config.ts`) deliberately invokes it twice to catch exactly this —
   * an impure updater with a side effect inside it. Both invocations read the
   * same `prevState.diet.updatedAt` and both called `persist`, so one edit
   * fired two writes racing on the same expected version; the second always
   * lost, surfacing as "Isso foi alterado em outro lugar" on a single tab
   * with a single edit. `apply` itself is an ordinary callback, not a render
   * function, so React never double-invokes it — the ref gives it the same
   * "read the version this edit actually grew out of" guarantee the comment
   * above described, without living inside a function React is allowed to
   * call twice.
   */
  const apply = useCallback(
    (change: (diet: Diet) => Diet) => {
      const prevState = stateRef.current;
      if (prevState.status !== "ready") return;

      const next = change(prevState.diet);
      // Edits addressing a meal or item that is no longer there return the
      // same diet. Nothing to store, nothing to re-render.
      if (next === prevState.diet) return;

      const nextState: DietEditorState = { status: "ready", diet: next };
      stateRef.current = nextState;
      setState(nextState);

      void persist(next, prevState.diet.updatedAt);

      async function persist(diet: Diet, expectedUpdatedAt: number) {
        setSaveError(null);
        setHasConflict(false);
        try {
          await (await repository).save(diet, expectedUpdatedAt);
        } catch (error) {
          setSaveError(describeDataError(error));
          setHasConflict(error instanceof DataError && error.code === "CONFLICT");
        }
      }
    },
    [repository],
  );

  return { state, saveError, hasConflict, apply, reload };
}
