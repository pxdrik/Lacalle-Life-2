"use client";

import { createContext, useContext } from "react";

import type { RoutineDraftRepository } from "./routine-draft-repository";

/** O rascunho aberto no editor do Life Pro, para os dias do treino. */
export const RoutineDraftContext = createContext<RoutineDraftRepository | null>(null);

export function useRoutineDraft(): RoutineDraftRepository {
  const draft = useContext(RoutineDraftContext);
  if (draft === null) throw new Error("useRoutineDraft must be used within a RoutineEditorDataProvider.");
  return draft;
}
