"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { CareRepositoryProvider } from "@/features/pro/data/care-repository-context";
import { FollowUpRepositoryProvider } from "@/features/pro/data/follow-up-repository-context";
import { PlanRepositoryProvider } from "@/features/pro/data/plan-repository-context";
import { ProRepositoryProvider } from "@/features/pro/data/pro-repository-context";
import { ProRoutineRepositoryProvider } from "@/features/pro/data/routine-repository-context";
import { createSupabaseCareRepository } from "@/features/pro/data/supabase-care-repository";
import { createSupabasePlanRepository } from "@/features/pro/data/supabase-plan-repository";
import { createSupabaseProRepository } from "@/features/pro/data/supabase-pro-repository";
import { createSupabaseRoutineRepository } from "@/features/pro/data/supabase-routine-repository";
import { TemplateRepositoryProvider } from "@/features/pro/data/template-repository-context";

import { createFollowUpRepository } from "./follow-up-repository";
import { flushTemplateDrafts } from "./template-editor-data-provider";
import { createTemplateRepository } from "./template-repository";

/**
 * Os repositórios do Life Pro (pedido de acesso, administração, vínculos,
 * convites, planos, treinos, a Biblioteca e o acompanhamento), lidos direto do Supabase: nada disto mora no IndexedDB, porque
 * é a conta que decide, não o aparelho.
 */
export function ProDataProvider({ children }: { readonly children: React.ReactNode }) {
  const [repositories] = useState(() => {
    const client = getSupabaseBrowserClient();
    return {
      pro: createSupabaseProRepository(client),
      care: createSupabaseCareRepository(client),
      plans: createSupabasePlanRepository(client),
      routines: createSupabaseRoutineRepository(client),
      templates: createTemplateRepository(client, flushTemplateDrafts),
      followUp: createFollowUpRepository(client),
    };
  });
  return (
    <ProRepositoryProvider repository={repositories.pro}>
      <CareRepositoryProvider repository={repositories.care}>
        <PlanRepositoryProvider repository={repositories.plans}>
          <ProRoutineRepositoryProvider repository={repositories.routines}>
            <TemplateRepositoryProvider repository={repositories.templates}>
              <FollowUpRepositoryProvider repository={repositories.followUp}>{children}</FollowUpRepositoryProvider>
            </TemplateRepositoryProvider>
          </ProRoutineRepositoryProvider>
        </PlanRepositoryProvider>
      </CareRepositoryProvider>
    </ProRepositoryProvider>
  );
}
