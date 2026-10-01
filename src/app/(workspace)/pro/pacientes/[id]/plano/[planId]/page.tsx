import type { Route } from "next";

import { PlanEditorDataProvider } from "@/composition/plan-editor-data-provider";
import { DietEditor } from "@/features/diet/components/diet-editor";
import { PlanPublishPanel } from "@/features/pro/components/pro/plan-publish-panel";

/**
 * O plano de um paciente, no editor de dieta do app (Etapa 5): os mesmos
 * cálculos, alimentos, orientação e outras opções por refeição. O que muda é
 * por trás: grava o rascunho no Supabase, e só publicar chega ao paciente.
 */
export default async function ProPlanEditorPage({
  params,
}: {
  readonly params: Promise<{ id: string; planId: string }>;
}) {
  const { id, planId } = await params;
  const patientHref = `/pro/pacientes/${id}` as Route;

  return (
    <PlanEditorDataProvider planId={planId} linkId={id}>
      <DietEditor
        dietId={planId}
        backHref={patientHref}
        backLabel="Paciente"
        editorPath={`/pro/pacientes/${id}/plano/${planId}`}
        nameLabel="Nome do plano"
        showTargets={false}
      />
      <PlanPublishPanel linkId={id} planId={planId} patientHref={patientHref} />
    </PlanEditorDataProvider>
  );
}
