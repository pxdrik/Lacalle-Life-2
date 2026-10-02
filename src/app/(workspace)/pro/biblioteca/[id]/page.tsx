import { TemplateEditorDataProvider } from "@/composition/template-editor-data-provider";
import { DietEditor } from "@/features/diet/components/diet-editor";

/**
 * Um modelo da Biblioteca no editor de dieta do app (Etapa 5d): os mesmos
 * cálculos, alimentos, orientação e outras opções por refeição do plano. Sem
 * dias e sem publicar: os dias são de cada plano, e o modelo só chega a um
 * paciente por "Usar em paciente", como cópia.
 */
export default async function ProTemplateEditorPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <TemplateEditorDataProvider templateId={id}>
      <DietEditor
        dietId={id}
        backHref="/pro/biblioteca"
        backLabel="Biblioteca"
        editorPath={`/pro/biblioteca/${id}`}
        nameLabel="Nome do modelo"
        showTargets={false}
      />
    </TemplateEditorDataProvider>
  );
}
