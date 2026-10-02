import { RoutineTemplateEditorDataProvider } from "@/composition/routine-template-editor-data-provider";
import { RoutineEditor } from "@/features/workouts/components/routine-editor";

/**
 * Um modelo de treino da Biblioteca no editor de treino do app: os mesmos
 * exercícios do catálogo, séries, descanso e observação do treino
 * prescrito. Sem dias, sem iniciar e sem publicar: o modelo só chega a um
 * paciente por "Usar em paciente", como cópia.
 */
export default async function ProRoutineTemplateEditorPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RoutineTemplateEditorDataProvider templateId={id}>
      <RoutineEditor
        routineId={id}
        backHref="/pro/biblioteca"
        backLabel="Biblioteca"
        backText="Voltar para a Biblioteca"
        showStart={false}
        catalogueOnly
      />
    </RoutineTemplateEditorDataProvider>
  );
}
