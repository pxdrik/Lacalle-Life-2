"use client";

import type { Route } from "next";

import { usePatientRoutines } from "../../hooks/use-patient-routines";
import { PublishPanel } from "./publish-panel";

/** Publicar o treino (0038): o `PublishPanel` com os treinos do vínculo. */
export function RoutinePublishPanel({
  linkId,
  routineId,
  patientHref,
}: {
  readonly linkId: string;
  readonly routineId: string;
  readonly patientHref: Route;
}) {
  const { state, publish } = usePatientRoutines(linkId);
  if (state.status !== "ready") return null;
  const routine = state.routines.find((item) => item.id === routineId);
  if (routine === undefined) return null;
  return (
    <PublishPanel
      current={routine.versions[0]?.version ?? 0}
      patientHref={patientHref}
      onPublish={(note) => publish(routineId, note)}
    />
  );
}
