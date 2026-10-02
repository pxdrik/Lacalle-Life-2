"use client";

import { useEffect, useState } from "react";

import { NOT_SHARED, type Shared } from "../types/follow-up";

export type FollowUpState<T> =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "not-shared" }
  | { readonly status: "ready"; readonly value: T };

/**
 * Uma leitura do acompanhamento (Etapa 6). `load` vem de um `useCallback`:
 * outra semana ou outro paciente é outro `load`, e a leitura recomeça. "Não
 * libera" é um estado, não um erro: a tela diz o que o paciente escolheu.
 *
 * O resultado guarda de qual `load` veio; enquanto o `load` atual não
 * responde, é "carregando", sem `setState` dentro do efeito.
 */
export function useFollowUp<T>(load: () => Promise<Shared<T>>): FollowUpState<T> {
  const [result, setResult] = useState<{ readonly from: unknown; readonly state: FollowUpState<T> } | null>(null);

  useEffect(() => {
    let active = true;
    load()
      .then((value) => {
        if (active) setResult({ from: load, state: value === NOT_SHARED ? { status: "not-shared" } : { status: "ready", value } });
      })
      .catch(() => {
        if (active) setResult({ from: load, state: { status: "error" } });
      });
    return () => {
      active = false;
    };
  }, [load]);

  return result?.from === load ? result.state : { status: "loading" };
}
