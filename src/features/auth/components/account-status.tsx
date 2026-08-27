"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonClasses } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";

import { useAuth } from "../hooks/use-auth";

/**
 * Quem está logado, e as duas ações que dependem disso — trocar a senha e
 * sair. Vive dentro de Perfil (26/08/2026: pedido do Pedro, "quero uma
 * parte na aba de perfil dizendo qual é meu email, senha, etc"), não mais
 * só na rota `/conta` isolada de antes, que nenhuma navegação linkava.
 */
export function AccountStatus() {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === "loading") {
    return <Skeleton className="h-24" />;
  }

  if (state.status === "anonymous") {
    return (
      <Notice tone="info" title="Você não está logado">
        <Link href="/entrar" className="text-ink hover:underline">
          Entrar
        </Link>{" "}
        ou{" "}
        <Link href="/cadastro" className="text-ink hover:underline">
          criar conta
        </Link>
        .
      </Notice>
    );
  }

  async function handleSignOut() {
    setError(null);
    setPending(true);

    try {
      await signOut();
      router.push("/entrar");
      router.refresh();
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
