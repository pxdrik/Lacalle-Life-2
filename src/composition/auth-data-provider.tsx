"use client";

import { useState } from "react";

import { AuthRepositoryProvider } from "@/features/auth/data/auth-repository-context";
import { createSupabaseAuthRepository } from "@/features/auth/data/supabase-auth-repository";

/**
 * Fio de composição do Auth, separado de `data-providers.tsx` (que é só os
 * oito repositórios de domínio) porque este não tem par local — não existe
 * `LocalAuthRepository`, então não há "qual implementação está por trás
 * desta interface" para decidir; há só uma.
 *
 * `useState(() => ...)` em vez do padrão `once()` dos outros: o cliente
 * Supabase é síncrono para criar (ver `supabase-browser-client.ts`), então
 * não precisa da forma de promessa cacheada que a abertura assíncrona do
 * IndexedDB exige.
 */
export function AuthDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [repository] = useState(createSupabaseAuthRepository);

  return (
    <AuthRepositoryProvider repository={repository}>
      {children}
    </AuthRepositoryProvider>
  );
}
