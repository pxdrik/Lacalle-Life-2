"use client";

import { useCallback, useEffect, useState } from "react";

import { useTemplateRepository } from "../data/template-repository-context";
import type { PlanTemplate } from "../data/template-repository";

export type TemplatesState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly templates: readonly PlanTemplate[] };

/** A Biblioteca da profissional logada (Etapa 5d). */
export function useTemplates() {
  const templates = useTemplateRepository();
  const [state, setState] = useState<TemplatesState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    templates
      .listTemplates()
      .then((list) => {
        if (active) setState({ status: "ready", templates: list });
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
    create: (name: string) => templates.createTemplate(name),
    remove: async (id: string) => {
      await templates.deleteTemplate(id);
      reload();
    },
    applyToPatient: (template: PlanTemplate, linkId: string) => templates.applyToPatient(template.id, linkId),
  };
}
