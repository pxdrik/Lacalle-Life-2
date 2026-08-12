import type { Metadata } from "next";

import { DietEditorDataProvider } from "@/composition/data-providers";
import { DietEditor } from "@/features/diet/components/diet-editor";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Dieta · LaCalle Life",
};

/**
 * The id exists only in the visitor's browser, so there is nothing for the
 * server to look up or prerender — it renders the shell and the editor reads
 * local storage after mount.
 */
export default async function DietPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell>
      <DietEditorDataProvider>
        <DietEditor dietId={id} />
      </DietEditorDataProvider>
    </PageShell>
  );
}
