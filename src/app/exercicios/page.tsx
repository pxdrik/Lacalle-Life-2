import type { Metadata } from "next";
import { Suspense } from "react";

import { ExerciseDataProvider } from "@/composition/data-providers";
import { ExerciseBrowser } from "@/features/workouts";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Exercícios · LaCalle Life",
};

export default function ExercisesPage() {
  return (
    <PageShell>
      <PageHeader
        icon={ICONS.exercises}
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
    </PageShell>
  );
}
