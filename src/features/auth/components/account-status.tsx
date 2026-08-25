"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";

import { useAuth } from "../hooks/use-auth";

/**
 * A prova de conclusão da Sprint de Auth: mostra `user.id` de verdade,
 * sobrevive a um refresh de página, e desloga de verdade — sem tocar em
 * nenhuma tela de domínio existente.
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
        <p className="text-sm text-ink-subtle">Logado como</p>
        <p className="text-ink">{state.user.email ?? state.user.id}</p>
        <p className="mt-2 font-mono text-xs text-ink-subtle">{state.user.id}</p>
      </div>

      <Button
        variant="secondary"
        pending={pending}
        onClick={() => void handleSignOut()}
      >
        Sair
      </Button>
    </div>
  );
}
