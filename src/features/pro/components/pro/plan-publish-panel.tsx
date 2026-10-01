"use client";

import type { Route } from "next";

import { usePatientPlans } from "../../hooks/use-patient-plans";
import { PublishPanel } from "./publish-panel";

/** Publicar o plano alimentar (0035): o `PublishPanel` com os planos do vínculo. */
export function PlanPublishPanel({
  linkId,
  planId,
  patientHref,
}: {
  readonly linkId: string;
  readonly planId: string;
  readonly patientHref: Route;
}) {
  const { state, publish } = usePatientPlans(linkId);
  if (state.status !== "ready") return null;
  const plan = state.plans.find((item) => item.id === planId);
  if (plan === undefined) return null;
  return (
    <PublishPanel
      current={plan.versions[0]?.version ?? 0}
      patientHref={patientHref}
      onPublish={(note) => publish(planId, note)}
    />
  );
}
