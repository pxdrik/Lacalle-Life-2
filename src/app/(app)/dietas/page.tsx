import type { Metadata } from "next";

import { DietDataProvider } from "@/composition/data-providers";
import { DietList } from "@/features/diet/components/diet-list";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Dietas · LaCalle Life",
};

export default function DietsPage() {
  return (
    <PageShell>
      <PageHeader
        icon={ICONS.diets}
        title="Dietas"
        subtitle="Suas refeições e seus totais."
      />

      <div className="mt-8">
        <DietDataProvider>
          <DietList />
        </DietDataProvider>
      </div>
    </PageShell>
  );
}
