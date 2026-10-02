"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import {
  ProRoutineRepositoryProvider,
  useProRoutineRepository,
} from "@/features/pro/data/routine-repository-context";
import { WorkoutRepositoryProvider } from "@/features/workouts/data/workout-repository-context";
import type { SessionRepository } from "@/features/workouts/data/session-repository";

import { ExerciseDataProvider } from "./data-providers";
import { createRoutineDraftRepository, type RoutineDraftRepository } from "./routine-draft-repository";
import { RoutineDraftContext } from "./routine-draft-context";

/**
 * O editor de treino do app editando o rascunho de um treino do Life Pro
 * (Etapa 8c). O par de `PlanEditorDataProvider`:
 *
 * - A rotina que o editor abre é o rascunho no Supabase, nunca o IndexedDB.
 * - Os exercícios são os do catálogo do aparelho (o editor abre com
 *   `catalogueOnly`): a rotina leva o nome e o id, e o catálogo é o mesmo em
 *   todo aparelho.
 * - Sem sessões: o treino é do paciente. A lista fica vazia (o seletor de
 *   exercícios ordenaria pelos treinos do próprio treinador, que não importam
 *   aqui) e gravar uma sessão é recusado.
 * - Publicar espera a última mudança chegar ao banco.
 * - Um repositório por treino na sessão, não por montagem, pelo mesmo motivo
 *   do plano: sair e voltar não pode ler o banco antes da última gravação.
 */
const drafts = new Map<string, RoutineDraftRepository>();

function draftFor(routineId: string, linkId: string) {
  let draft = drafts.get(routineId);
  if (draft === undefined) {
    draft = createRoutineDraftRepository(getSupabaseBrowserClient(), { routineId, linkId });
    drafts.set(routineId, draft);
  }
  return draft;
}

export const NO_SESSIONS: SessionRepository = {
  listAll: () => Promise.resolve([]),
  findInProgress: () => Promise.resolve(undefined),
  getById: () => Promise.resolve(undefined),
  save: () => Promise.reject(new Error("O treino prescrito não começa no Life Pro.")),
  remove: () => Promise.reject(new Error("O treino prescrito não começa no Life Pro.")),
};

export function RoutineEditorDataProvider({
  routineId,
  linkId,
  children,
}: {
  readonly routineId: string;
  readonly linkId: string;
  readonly children: React.ReactNode;
}) {
  const routines = useProRoutineRepository();
  const [repositories] = useState(() => {
    const draft = draftFor(routineId, linkId);
    return {
      draft,
      workout: Promise.resolve({ routines: draft, sessions: NO_SESSIONS }),
      routines: {
        ...routines,
        publish: async (id: string, changeNote: string) => {
          await draft.flush();
          return routines.publish(id, changeNote);
        },
      },
    };
  });

  return (
    <ProRoutineRepositoryProvider repository={repositories.routines}>
      <WorkoutRepositoryProvider repositories={repositories.workout}>
        <RoutineDraftContext value={repositories.draft}>
          <ExerciseDataProvider>{children}</ExerciseDataProvider>
        </RoutineDraftContext>
      </WorkoutRepositoryProvider>
    </ProRoutineRepositoryProvider>
  );
}
