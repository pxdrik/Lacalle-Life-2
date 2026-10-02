"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { WorkoutRepositoryProvider } from "@/features/workouts/data/workout-repository-context";
import type { Routine } from "@/features/workouts/types/routine";

import { ExerciseDataProvider } from "./data-providers";
import type { QueuedRepository } from "./plan-draft-repository";
import { NO_SESSIONS } from "./routine-editor-data-provider";
import { createRoutineTemplateDraftRepository } from "./template-repository";

/**
 * O editor de treino do app editando um modelo de treino da Biblioteca, como
 * o `RoutineEditorDataProvider` faz com o rascunho de um treino prescrito, e
 * pelo mesmo motivo um repositório por modelo na sessão, não por montagem:
 * sair para escolher um exercício e voltar não pode ler o banco antes de a
 * última gravação chegar. Sem treino em andamento: o modelo não se inicia.
 */
const drafts = new Map<string, QueuedRepository<Routine>>();

function draftFor(templateId: string) {
  let draft = drafts.get(templateId);
  if (draft === undefined) {
    draft = createRoutineTemplateDraftRepository(getSupabaseBrowserClient(), templateId);
    drafts.set(templateId, draft);
  }
  return draft;
}

/** Espera as gravações de modelo de treino ainda a caminho, antes de a Biblioteca listar. */
export function flushRoutineTemplateDrafts(): Promise<unknown> {
  return Promise.all([...drafts.values()].map((draft) => draft.flush().catch(() => undefined)));
}

export function RoutineTemplateEditorDataProvider({
  templateId,
  children,
}: {
  readonly templateId: string;
  readonly children: React.ReactNode;
}) {
  const [repositories] = useState(() => Promise.resolve({ routines: draftFor(templateId), sessions: NO_SESSIONS }));

  return (
    <WorkoutRepositoryProvider repositories={repositories}>
      <ExerciseDataProvider>{children}</ExerciseDataProvider>
    </WorkoutRepositoryProvider>
  );
}
