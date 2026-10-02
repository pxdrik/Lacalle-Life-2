"use client";

import { useCallback, useEffect, useState } from "react";

import { usePlanRepository } from "../data/plan-repository-context";
import type { PlanSummary } from "../types/plan";

export type PatientPlansState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly plans: readonly PlanSummary[] };

/** Os planos de um vínculo, como a profissional vê. */
export function usePatientPlans(linkId: string) {
  const repository = usePlanRepository();
  const [state, setState] = useState<PatientPlansState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    repository
      .listPlans(linkId)
      .then((plans) => {
        if (active) setState({ status: "ready", plans });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [repository, linkId, version]);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return {
    state,
    reload,
    createPlan: (name: string) => repository.createPlan(linkId, name),
    publish: async (planId: string, changeNote: string) => {
      const published = await repository.publish(planId, changeNote);
      reload();
      return published;
    },
  };
}
