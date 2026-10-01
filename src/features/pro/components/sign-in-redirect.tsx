"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Skeleton } from "@/design-system/components/skeleton";

/**
 * Life Pro e administração sem conta (pedido do Pedro, 01/10/2026, antes de
 * publicar): em vez de mostrar a área para quem nem entrou, leva para Entrar
 * e volta para cá depois, pelo mesmo `?next=` do convite.
 */
export function SignInRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    router.replace(`/entrar?${new URLSearchParams({ next: pathname }).toString()}`);
  }, [router, pathname]);

  return (
    <div className="mx-auto max-w-lg space-y-3 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32" />
    </div>
  );
}
