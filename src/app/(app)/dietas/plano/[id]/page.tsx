import type { Metadata } from "next";

import { DietDataProvider } from "@/composition/data-providers";
import { PrescribedPlanScreen } from "@/features/diet/components/prescribed-plan-screen";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Plano do treinador · LaCalle Life",
};

/** O plano recebido do Life Pro, só leitura. Vem do aparelho, como as dietas. */
export default async function PrescribedPlanPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <DietDataProvider>
        <PrescribedPlanScreen planId={id} />
      </DietDataProvider>
    </PageShell>
  );
}
