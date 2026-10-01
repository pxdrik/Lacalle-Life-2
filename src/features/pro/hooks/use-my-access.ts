"use client";

import { useCallback, useEffect, useState } from "react";

import { useProRepository } from "../data/pro-repository-context";
import type { MyAccess, ProfessionalRequestInput } from "../types/professional";

export type MyAccessState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly access: MyAccess | null };

/**
 * O que a conta logada pode fazer no Life Pro: o próprio pedido de acesso e
 * se ela administra. `access: null` é "sem conta".
 */
export function useMyAccess() {
  const repository = useProRepository();
  const [state, setState] = useState<MyAccessState>({ status: "loading" });
  // Mudar a versão pede uma leitura nova (depois de enviar um pedido).
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    repository
      .getMyAccess()
      .then((access) => {
        if (active) setState({ status: "ready", access });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      active = false;
    };
  }, [repository, version]);

  const request = useCallback(
    async (input: ProfessionalRequestInput) => {
      await repository.requestAccess(input);
      setVersion((current) => current + 1);
    },
    [repository],
  );

  return { state, request };
}
