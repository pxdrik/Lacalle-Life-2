import type { Metadata } from "next";

import { DietEditorDataProvider } from "@/composition/data-providers";
import { DietEditor } from "@/features/diet/components/diet-editor";

export const metadata: Metadata = {
  title: "Dieta · Lacalle Life",
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
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <DietEditorDataProvider>
        <DietEditor dietId={id} />
      </DietEditorDataProvider>
    </main>
  );
}
