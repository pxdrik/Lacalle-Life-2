"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { DietRepositoryProvider } from "@/features/diet/data/diet-repository-context";

import { FoodDataProvider } from "./data-providers";
import { createTemplateDraftDietRepository, type QueuedDietRepository } from "./plan-draft-repository";

/**
 * O editor de dieta do app editando um modelo da Biblioteca (Etapa 5d), como
 * o `PlanEditorDataProvider` faz com o rascunho de um plano, e pelo mesmo
 * motivo um repositório por modelo na sessão, não por montagem: sair para
 * escolher um alimento e voltar não pode ler o banco antes de a última
 * gravação chegar.
 */
const drafts = new Map<string, QueuedDietRepository>();

function draftFor(templateId: string) {
  let draft = drafts.get(templateId);
  if (draft === undefined) {
    draft = createTemplateDraftDietRepository(getSupabaseBrowserClient(), templateId);
    drafts.set(templateId, draft);
  }
  return draft;
}

/**
 * Espera as gravações de modelo ainda a caminho. A Biblioteca lista depois
 * disto: voltando do editor, o cartão já mostra a última mudança.
 */
export function flushTemplateDrafts(): Promise<unknown> {
  return Promise.all([...drafts.values()].map((draft) => draft.flush().catch(() => undefined)));
}

export function TemplateEditorDataProvider({
  templateId,
  children,
}: {
  readonly templateId: string;
  readonly children: React.ReactNode;
}) {
  const [repository] = useState(() => Promise.resolve(draftFor(templateId)));

  return (
    <DietRepositoryProvider repository={repository}>
      <FoodDataProvider>{children}</FoodDataProvider>
    </DietRepositoryProvider>
  );
}
