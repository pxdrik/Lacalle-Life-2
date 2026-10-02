"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { DietRepositoryProvider } from "@/features/diet/data/diet-repository-context";
import { PlanRepositoryProvider, usePlanRepository } from "@/features/pro/data/plan-repository-context";

import { FoodDataProvider } from "./data-providers";
import { createPlanDraftDietRepository } from "./plan-draft-repository";

/**
 * O editor de dieta do app editando o rascunho de um plano do Life Pro.
 *
 * - A "dieta" que o editor abre é o rascunho no Supabase, nunca o IndexedDB.
 * - Os alimentos são os do aparelho da profissional (a base do app e os
 *   dela): cada item leva a cópia dos nutrientes, o plano não depende deles.
 * - Sem metas: as do perfil seriam as da profissional (`showTargets`).
 * - Publicar espera a última mudança chegar ao banco, porque o banco publica
 *   o rascunho que tem; sem isso, a última edição podia ficar de fora.
 * - Um repositório por plano na sessão, não por montagem: "Adicionar
 *   alimento" sai para `/alimentos/selecionar` e volta, e um repositório novo
 *   leria o banco antes de a última gravação chegar. O alimento escolhido
 *   entraria em cima do rascunho antigo e apagaria a edição anterior.
 */
const drafts = new Map<string, ReturnType<typeof createPlanDraftDietRepository>>();

function draftFor(planId: string, linkId: string) {
  let draft = drafts.get(planId);
  if (draft === undefined) {
    draft = createPlanDraftDietRepository(getSupabaseBrowserClient(), { planId, linkId });
    drafts.set(planId, draft);
  }
  return draft;
}

export function PlanEditorDataProvider({
  planId,
  linkId,
  children,
}: {
  readonly planId: string;
  readonly linkId: string;
  readonly children: React.ReactNode;
}) {
  const plans = usePlanRepository();
  const [repositories] = useState(() => {
    const draft = draftFor(planId, linkId);
    return {
      draft: Promise.resolve(draft),
      plans: {
        ...plans,
        publish: async (id: string, changeNote: string) => {
          await draft.flush();
          return plans.publish(id, changeNote);
        },
      },
    };
  });

  return (
    <PlanRepositoryProvider repository={repositories.plans}>
      <DietRepositoryProvider repository={repositories.draft}>
        <FoodDataProvider>{children}</FoodDataProvider>
      </DietRepositoryProvider>
    </PlanRepositoryProvider>
  );
}
