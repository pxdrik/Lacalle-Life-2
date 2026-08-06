import type { Metadata } from "next";
import { Suspense } from "react";

import { ExerciseDataProvider } from "@/composition/data-providers";
import { ExerciseBrowser } from "@/features/workouts";

export const metadata: Metadata = {
  title: "Exercícios · Lacalle Life",
};

export default function ExercisesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Exercícios</h1>
      <p className="mt-1.5 text-ink-muted">
        O catálogo que seus treinos usam.
      </p>

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
