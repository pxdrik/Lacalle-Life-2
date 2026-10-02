"use client";

import { useCallback, useEffect, useState } from "react";

import { useProRepository } from "../data/pro-repository-context";
import type { AuditEntry, ProfessionalRecord, RejectionReason } from "../types/professional";

export type AdminState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly professionals: readonly ProfessionalRecord[];
      readonly audit: readonly AuditEntry[];
    };

/**
 * A tela de administração: os pedidos, os aprovados e o histórico. Cada
 * decisão vai ao banco (que confere se quem chama é administrador) e a lista
 * é lida de novo, em vez de ser corrigida à mão aqui: o que aparece é sempre
 * o que o banco guardou.
 */
export function useAdmin() {
  const repository = useProRepository();
  const [state, setState] = useState<AdminState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([repository.listProfessionals(), repository.listAudit()])
      .then(([professionals, audit]) => {
        if (active) setState({ status: "ready", professionals, audit });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      active = false;
    };
  }, [repository, version]);

  const act = useCallback(async (run: () => Promise<void>) => {
    await run();
    setVersion((current) => current + 1);
  }, []);

  return {
    state,
    approve: (userId: string) => act(() => repository.approve(userId)),
    reject: (userId: string, reason: RejectionReason) => act(() => repository.reject(userId, reason)),
    setSuspended: (userId: string, suspended: boolean) => act(() => repository.setSuspended(userId, suspended)),
  };
}
