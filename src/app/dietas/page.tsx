import type { Metadata } from "next";

import { DietDataProvider } from "@/composition/data-providers";
import { DietList } from "@/features/diet/components/diet-list";
import { PageHeader } from "@/design-system/components/page-header";

export const metadata: Metadata = {
  title: "Dietas · Lacalle Life",
};

export default function DietsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <PageHeader title="Dietas" subtitle="Suas refeições e seus totais." />

      <div className="mt-8">
        <DietDataProvider>
          <DietList />
        </DietDataProvider>
      </div>
    </main>
  );
}
