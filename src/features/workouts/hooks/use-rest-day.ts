"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import { onStoreChanged } from "@/core/storage/store-events";

import { useRestDayRepository } from "../data/rest-day-repository-context";
import { createRestDay } from "../types/rest-day";

export type RestDayState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly isRest: boolean }
  | { readonly status: "error"; readonly message: string };

export interface RestDayControl {
  readonly state: RestDayState;
  readonly saveError: string | null;
  /** Marca ou desmarca o dia. Otimista: a tela muda antes de gravar. */
  readonly setRest: (isRest: boolean) => void;
}

/**
 * Se `day` está marcado como descanso — roadmap 7.5. Relê quando a store muda
 * (um pull de sincronização, outra aba), mesmo padrão de `useWaterDay`.
 */
export function useRestDay(day: string): RestDayControl {
  const repository = useRestDayRepository();
  const [loaded, setLoaded] = useState<{
    readonly day: string;
    readonly state: RestDayState;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const stored = await (await repository).getByDay(day);
        if (active) setLoaded({ day, state: { status: "ready", isRest: stored !== undefined } });
      } catch (cause) {
        if (active) setLoaded({ day, state: { status: "error", message: describeDataError(cause) } });
      }
    }

    void load();
    const unsubscribe = onStoreChanged("restDays", () => {
      void load();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository, day]);

  const setRest = useCallback(
    (isRest: boolean) => {
      setSaveError(null);
      setLoaded({ day, state: { status: "ready", isRest } });

      void (async () => {
        try {
          const store = await repository;
          if (isRest) {
            // Ler antes de gravar: marcar um dia já marcado (outra aba) não é erro.
            const current = await store.getByDay(day);
            if (current === undefined) await store.save(createRestDay(day), null);
          } else {
            await store.remove(day);
          }
        } catch (cause) {
          setSaveError(describeDataError(cause));
          setLoaded({ day, state: { status: "ready", isRest: !isRest } });
        }
      })();
    },
    [repository, day],
  );

  const state: RestDayState =
    loaded !== null && loaded.day === day ? loaded.state : { status: "loading" };

  return { state, saveError, setRest };
}
