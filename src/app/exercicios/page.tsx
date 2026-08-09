import type { Metadata } from "next";
import { Suspense } from "react";

import { ExerciseDataProvider } from "@/composition/data-providers";
import { ExerciseBrowser } from "@/features/workouts";
import { PageHeader } from "@/design-system/components/page-header";

export const metadata: Metadata = {
  title: "Exercícios · Lacalle Life",
};

export default function ExercisesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <PageHeader
        title="Exercícios"
        subtitle="O catálogo que seus treinos usam."
      />

      <div className="mt-8">
        {/* The browser reads filters from the URL, and `useSearchParams`
            requires a boundary so the shell can still be prerendered. */}
        <Suspense fallback={null}>
          <ExerciseDataProvider>
            <ExerciseBrowser />
          </ExerciseDataProvider>
        </Suspense>
      </div>
    </main>
  );
}
