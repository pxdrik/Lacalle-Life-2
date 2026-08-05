"use client";

import { useEffect, useState } from "react";

import { getRepositories } from "@/composition/repositories";
import { DataError } from "@/core/domain/data-error";

import type { Food } from "../types/food";

/**
 * Illegal states are unrepresentable: there is no way to hold foods *and* an
 * error, or to be loading *and* ready.
 */
export type FoodCatalogueState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly foods: readonly Food[] }
  | { readonly status: "error"; readonly message: string };

/**
 * Loads the whole catalogue once, after mount.
 *
 * All of it, deliberately. A few hundred rows is a single ~2 ms read, and
 * holding them in memory is what lets search filter without touching storage
 * again — no debounce, no per-keystroke query, no spinner.
 *
 * After mount rather than during render because IndexedDB does not exist on
 * the server, and this app's data has no server representation to prerender.
 */
export function useFoodCatalogue(): FoodCatalogueState {
  const [state, setState] = useState<FoodCatalogueState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { foods } = await getRepositories();
        const all = await foods.listAll();
        if (active) setState({ status: "ready", foods: all });
      } catch (error) {
        if (active) setState({ status: "error", message: describe(error) });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return state;
}

function describe(error: unknown): string {
  if (error instanceof DataError) {
    switch (error.code) {
      case "UNAVAILABLE":
        return "Seu navegador está bloqueando o armazenamento local. Verifique se a navegação anônima ou alguma extensão está impedindo o acesso.";
      case "QUOTA_EXCEEDED":
        return "O armazenamento do navegador está cheio. Libere espaço para continuar.";
      case "BLOCKED":
        return "Outra aba do Lacalle Life está aberta com uma versão anterior. Feche-a e recarregue esta página.";
      case "FAILED":
        return "Não foi possível ler os alimentos salvos. Recarregue a página.";
    }
  }

  return "Algo deu errado ao carregar os alimentos. Recarregue a página.";
}
