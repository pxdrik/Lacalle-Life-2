"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { ProRepositoryProvider } from "@/features/pro/data/pro-repository-context";
import { createSupabaseProRepository } from "@/features/pro/data/supabase-pro-repository";

/**
 * O repositório do Life Pro (pedido de acesso e administração), lido direto
 * do Supabase: nada disto mora no IndexedDB, porque é a conta que decide, não
 * o aparelho.
 */
export function ProDataProvider({ children }: { readonly children: React.ReactNode }) {
  const [repository] = useState(() => createSupabaseProRepository(getSupabaseBrowserClient()));
  return <ProRepositoryProvider repository={repository}>{children}</ProRepositoryProvider>;
}
