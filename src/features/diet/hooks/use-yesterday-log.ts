"use client";

import { useEffect, useState } from "react";

import { shiftDay } from "@/core/format/day";

import { useFoodLogRepository } from "../data/food-log-repository-context";
import type { FoodLog } from "../types/food-log";

/**
 * O registro do dia anterior ao `day` aberto no Diário, para o "Igual a
 * ontem?" (roadmap 7.3, 30/09/2026).
 *
 * `undefined` enquanto carrega, quando ontem não tem registro, ou se a
 * leitura falhar: nos três casos a faixa simplesmente não aparece, e o
 * Diário funciona igual. O erro de leitura de verdade já aparece no próprio
 * dia aberto, que usa o mesmo repositório.
 */
export function useYesterdayLog(day: string): FoodLog | undefined {
  const repository = useFoodLogRepository();
  const [loaded, setLoaded] = useState<{
    readonly day: string;
    readonly log: FoodLog | undefined;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const log = await (await repository).getByDay(shiftDay(day, -1));
        if (active) setLoaded({ day, log });
      } catch {
        // Sem "igual a ontem" é um estado válido; ver o comentário acima.
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [repository, day]);

  // Trocar de dia não pode mostrar por um instante o "ontem" do dia anterior.
  return loaded !== null && loaded.day === day ? loaded.log : undefined;
}
