"use client";

import { FileCheck2, History, UserCheck } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";
import { WorkspaceShell } from "@/design-system/components/workspace-shell";

import { AdminProvider, useAdminData } from "../../hooks/admin-context";
import { useMyAccess } from "../../hooks/use-my-access";

/**
 * A área de administração (protótipo aprovado em 01/10/2026). Só a conta
 * marcada como administradora no banco vê o conteúdo; para as outras, um
 * aviso. Esconder não é a proteção: as funções do banco recusam quem não é
 * administrador (0033), e esta tela só evita mostrar um erro cru.
 */
export function AdminShell({ children }: { readonly children: React.ReactNode }) {
  const { state } = useMyAccess();

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (state.status === "error" || state.access?.isAdmin !== true) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card className="space-y-3">
          <p className="font-medium text-ink">Esta área é só da administração do LaCalle.</p>
          <p className="text-sm text-ink-muted">
            {state.status === "error"
              ? "Não foi possível conferir sua conta agora. Confira a conexão e tente de novo."
              : "Entre com a conta de administração para ver os pedidos."}
          </p>
          <Link href="/perfil" className={buttonClasses("secondary", "sm")}>
            Voltar para o Perfil
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <AdminProvider>
      <AdminWorkspace>{children}</AdminWorkspace>
    </AdminProvider>
  );
}

function AdminWorkspace({ children }: { readonly children: React.ReactNode }) {
  const { state } = useAdminData();
  const pending = state.status === "ready" ? state.professionals.filter((p) => p.status === "pending").length : 0;

  return (
    <WorkspaceShell
      badge="Admin"
      title="Administração"
      links={[
        { href: "/admin", label: "Pedidos", icon: FileCheck2, count: pending },
        { href: "/admin/aprovados", label: "Aprovados", icon: UserCheck },
        { href: "/admin/historico", label: "Histórico", icon: History },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
