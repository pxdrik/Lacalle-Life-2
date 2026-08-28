"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { isSupabaseConfigured } from "@/core/auth/env";
import { createSupabaseAuthRepository } from "@/features/auth/data/supabase-auth-repository";

import { hasEnteredAppBefore } from "../../_lib/entered-app";

/**
 * Sem saída visível — decide, em silêncio, se `/` deveria nem ter aparecido.
 *
 * Vive dentro da própria Landing Page em vez de um redirecionamento de
 * servidor porque as duas coisas que decidem "esta pessoa já usa o app" só
 * existem no navegador: uma sessão do Supabase (não há checagem de sessão no
 * `middleware.ts` deste app, por desenho, e criar uma aqui só para esta tela
 * seria a arquitetura de auth mudando por causa da Landing Page, exatamente o
 * que o pedido pede para evitar) e `hasEnteredAppBefore`, puramente local. O
 * efeito é o preço: quem já usa o app vê a Landing por um instante antes do
 * redirecionamento — aceito de propósito, para que a primeira visita (o caso
 * comum) chegue com HTML já pronto, sem esperar por nenhuma checagem.
 *
 * `createSupabaseAuthRepository()` direto, sem `AuthDataProvider`: o mesmo
 * padrão que `app/diario/food-log-sync-status.tsx` já usa para ler "há
 * sessão?" sem montar o provider inteiro, guardado atrás do mesmo
 * `isSupabaseConfigured()` para nunca lançar num ambiente sem as variáveis.
 */
export function LandingRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (hasEnteredAppBefore()) {
      router.replace("/hoje");
      return;
    }

    if (!isSupabaseConfigured()) return;

    let active = true;
    const repository = createSupabaseAuthRepository();

    void repository.getUser().then((user) => {
      if (active && user !== null) router.replace("/hoje");
    });

    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
