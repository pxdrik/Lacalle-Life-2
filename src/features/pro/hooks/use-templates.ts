"use client";

import { useCallback, useEffect, useState } from "react";

import { useTemplateRepository } from "../data/template-repository-context";
import type { PlanTemplate, RoutineTemplate } from "../data/template-repository";

/** Os dois tipos de modelo da Biblioteca. */
export type TemplateKind = "plans" | "routines";

export type TemplatesState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly plans: readonly PlanTemplate[]; readonly routines: readonly RoutineTemplate[] };

/** A Biblioteca do treinador logado (Etapa 5d; modelos de treino desde 0040). */
export function useTemplates() {
  const templates = useTemplateRepository();
  const [state, setState] = useState<TemplatesState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([templates.listTemplates(), templates.listRoutineTemplates()])
      .then(([plans, routines]) => {
        if (active) setState({ status: "ready", plans, routines });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [templates, version]);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return {
    state,
    create: (kind: TemplateKind, name: string) =>
      kind === "plans" ? templates.createTemplate(name) : templates.createRoutineTemplate(name),
    remove: async (kind: TemplateKind, id: string) => {
      await (kind === "plans" ? templates.deleteTemplate(id) : templates.deleteRoutineTemplate(id));
      reload();
    },
    applyToPatient: (kind: TemplateKind, id: string, linkId: string) =>
      kind === "plans" ? templates.applyToPatient(id, linkId) : templates.applyRoutineToPatient(id, linkId),
  };
}
