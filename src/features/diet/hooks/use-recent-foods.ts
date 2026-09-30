"use client";

import { useEffect, useState } from "react";

import { dayKey } from "@/core/format/day";
import type { RecentFood } from "@/features/foods";

import { useFoodLogRepository } from "../data/food-log-repository-context";
import { recentFoods } from "../services/recent-foods";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Recente de mais de dois meses não é recente. Também poupa ler o diário inteiro. */
const WINDOW_DAYS = 60;

/**
 * Os recentes do seletor de alimentos (roadmap 7.2, 30/09/2026).
 *
 * Mesmo padrão de `useDietAdherence`: uma janela de dias pelo repositório, e
 * `active` para não escrever estado depois de desmontar. Enquanto carrega, ou
 * se a leitura falhar, devolve lista vazia: a seção "Recentes" simplesmente
 * não aparece, e o resto do seletor funciona igual.
 */
export function useRecentFoods(): readonly RecentFood[] {
  const foodLogRepository = useFoodLogRepository();
  const [recents, setRecents] = useState<readonly RecentFood[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const now = Date.now();
        const today = dayKey(new Date(now));
        const yesterday = dayKey(new Date(now - DAY_MS));
        const from = dayKey(new Date(now - WINDOW_DAYS * DAY_MS));
        const logs = await (await foodLogRepository).listBetween(from, today);
        if (active) setRecents(recentFoods(logs, today, yesterday));
      } catch {
        // Sem recentes é um estado válido do seletor; o erro de leitura do
        // diário já aparece na tela do próprio Diário.
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [foodLogRepository]);

  return recents;
}
