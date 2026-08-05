import type { Metadata } from "next";

import { DietDataProvider } from "@/composition/data-providers";
import { DietList } from "@/features/diet/components/diet-list";

export const metadata: Metadata = {
  title: "Dietas · Lacalle Life",
};

export default function DietsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Dietas</h1>
      <p className="mt-1.5 text-ink-muted">Suas refeições e seus totais.</p>

      <div className="mt-8">
        <DietDataProvider>
          <DietList />
        </DietDataProvider>
      </div>
    </main>
  );
}
