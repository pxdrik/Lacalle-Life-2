"use client";

import { useState } from "react";
import Link from "next/link";

import { Button, buttonClasses } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";

import { hardNavigateTo } from "../data/hard-navigate";
import { useAuth } from "../hooks/use-auth";

/**
 * Quem está logado, e as duas ações que dependem disso — trocar a senha e
 * sair. Vive dentro de Perfil (26/08/2026: pedido do Pedro, "quero uma
 * parte na aba de perfil dizendo qual é meu email, senha, etc"), não mais
 * só na rota `/conta` isolada de antes, que nenhuma navegação linkava.
 */
export function AccountStatus() {
  const { state, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === "loading") {
    return <Skeleton className="h-24" />;
  }

  if (state.status === "anonymous") {
    // Roadmap 9.1 (30/09/2026): diz o que muda sem conta, em vez de só
    // "Você não está logado". "Entrar" é o botão verde, a pedido do Pedro;
    // sem perfil preenchido a tela tem dois botões principais, esta exceção
    // está registrada em docs/brandbook.md.
    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm font-medium text-ink">Você está usando sem conta</p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Seus dados ficam só neste aparelho. Com uma conta, eles aparecem nos
          seus outros aparelhos.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/entrar" className={buttonClasses("primary")}>
            Entrar
          </Link>
          <Link href="/cadastro" className={buttonClasses("secondary")}>
            Criar conta
          </Link>
        </div>
      </div>
    );
  }

  async function handleSignOut() {
    setError(null);
    setPending(true);

    try {
      await signOut();
      hardNavigateTo("/entrar");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sair.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error !== null && <Notice>{error}</Notice>}

      <div className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm text-ink-subtle">E-mail</p>
        <p className="text-ink">{state.user.email ?? state.user.id}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/atualizar-senha" className={buttonClasses("secondary")}>
          Trocar senha
        </Link>
        <Button
          variant="secondary"
          pending={pending}
          onClick={() => void handleSignOut()}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}
