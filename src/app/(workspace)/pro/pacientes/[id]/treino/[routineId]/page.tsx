import type { Route } from "next";

import { RoutineDraftDays } from "@/composition/routine-draft-days";
import { RoutineEditorDataProvider } from "@/composition/routine-editor-data-provider";
import { RoutinePublishPanel } from "@/features/pro/components/pro/routine-publish-panel";
import { RoutineEditor } from "@/features/workouts/components/routine-editor";

/**
 * O treino de um paciente, no editor de treino do app (Etapa 8c): os mesmos
 * exercícios do catálogo, séries, descanso e observação. O que muda é por
 * trás: grava o rascunho no Supabase, e só publicar chega ao paciente.
 */
export default async function ProRoutineEditorPage({
  params,
}: {
  readonly params: Promise<{ id: string; routineId: string }>;
}) {
  const { id, routineId } = await params;
  const patientHref = `/pro/pacientes/${id}` as Route;

  return (
    <RoutineEditorDataProvider routineId={routineId} linkId={id}>
      <RoutineEditor
        routineId={routineId}
        backHref={patientHref}
        backLabel="Paciente"
        backText="Voltar para o paciente"
        showStart={false}
        catalogueOnly
        belowName={<RoutineDraftDays />}
      />
      <RoutinePublishPanel linkId={id} routineId={routineId} patientHref={patientHref} />
    </RoutineEditorDataProvider>
  );
}
