"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { CareRepositoryProvider } from "@/features/pro/data/care-repository-context";
import { PlanRepositoryProvider } from "@/features/pro/data/plan-repository-context";
import { ProRepositoryProvider } from "@/features/pro/data/pro-repository-context";
import { createSupabaseCareRepository } from "@/features/pro/data/supabase-care-repository";
import { createSupabasePlanRepository } from "@/features/pro/data/supabase-plan-repository";
import { createSupabaseProRepository } from "@/features/pro/data/supabase-pro-repository";

/**
 * Os repositórios do Life Pro (pedido de acesso, administração, vínculos,
 * convites e planos), lidos direto do Supabase: nada disto mora no IndexedDB, porque
 * é a conta que decide, não o aparelho.
 */
export function ProDataProvider({ children }: { readonly children: React.ReactNode }) {
  const [repositories] = useState(() => {
    const client = getSupabaseBrowserClient();
    return {
      pro: createSupabaseProRepository(client),
      care: createSupabaseCareRepository(client),
      plans: createSupabasePlanRepository(client),
    };
  });
  return (
    <ProRepositoryProvider repository={repositories.pro}>
      <CareRepositoryProvider repository={repositories.care}>
        <PlanRepositoryProvider repository={repositories.plans}>{children}</PlanRepositoryProvider>
      </CareRepositoryProvider>
    </ProRepositoryProvider>
  );
}
