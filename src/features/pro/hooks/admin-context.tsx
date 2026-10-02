"use client";

import { createContext, useContext } from "react";

import { useAdmin } from "./use-admin";

type AdminData = ReturnType<typeof useAdmin>;

const AdminContext = createContext<AdminData | null>(null);

/**
 * Um carregamento só para a área inteira: o número de pedidos na barra
 * lateral e as três telas (Pedidos, Aprovados, Histórico) leem o mesmo
 * estado, e uma decisão numa tela já aparece nas outras.
 */
export function AdminProvider({ children }: { readonly children: React.ReactNode }) {
  const admin = useAdmin();
  return <AdminContext value={admin}>{children}</AdminContext>;
}

export function useAdminData(): AdminData {
  const admin = useContext(AdminContext);
  if (admin === null) throw new Error("useAdminData must be used within an AdminProvider.");
  return admin;
}
