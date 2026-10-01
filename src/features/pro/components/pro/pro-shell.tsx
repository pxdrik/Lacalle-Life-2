"use client";

import { LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";
import { WorkspaceShell } from "@/design-system/components/workspace-shell";

import { useMyAccess } from "../../hooks/use-my-access";
import { SignInRedirect } from "../sign-in-redirect";

/**
 * O Life Pro (protótipo v3, 28/09/2026), só para profissional aprovado. As
 * seções entram na navegação quando funcionam (a especificação pede para não
 * pôr seção de mentira no menu): por enquanto Visão geral e Pacientes; Dietas,
 * Evolução e Biblioteca chegam com as Etapas 5 e 6.
 *
 * Esconder não protege: cada leitura e escrita passa por funções do banco que
 * conferem a aprovação e o vínculo (0033, 0034).
 */
export function ProShell({ children }: { readonly children: React.ReactNode }) {
  const { state } = useMyAccess();

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  // Sem conta, nada da área: vai entrar e volta para cá.
  if (state.status === "ready" && state.access === null) return <SignInRedirect />;

  if (state.status === "error" || state.access?.professional?.status !== "approved") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card className="space-y-3">
          <p className="font-medium text-ink">O Life Pro é para profissionais aprovados.</p>
          <p className="text-sm text-ink-muted">
            {state.status === "error"
              ? "Não foi possível conferir sua conta agora. Confira a conexão e tente de novo."
              : "Peça acesso em Perfil, na Área profissional. Quando a LaCalle aprovar, o Life Pro abre aqui."}
          </p>
          <Link href="/perfil" className={buttonClasses("secondary", "sm")}>
            Ir para o Perfil
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <WorkspaceShell
      badge="Pro"
      title="Consultório"
      links={[
        { href: "/pro", label: "Visão geral", icon: LayoutDashboard },
        { href: "/pro/pacientes", label: "Pacientes", icon: Users },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
