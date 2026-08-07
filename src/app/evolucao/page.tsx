import type { Metadata } from "next";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { EvolutionScreen } from "@/features/workouts/components/evolution-screen";

export const metadata: Metadata = {
  title: "Evolução · Lacalle Life",
};

export default function EvolutionPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Evolução</h1>
      <p className="mt-1.5 text-ink-muted">
        O que você levantou, e como isso mudou.
      </p>

      <div className="mt-8">
        <WorkoutDataProvider>
          <EvolutionScreen />
        </WorkoutDataProvider>
      </div>
    </main>
  );
}
