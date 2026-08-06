import type { Metadata } from "next";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { RoutineList } from "@/features/workouts/components/routine-list";

export const metadata: Metadata = {
  title: "Treinos · Lacalle Life",
};

export default function WorkoutsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Treinos</h1>
      <p className="mt-1.5 text-ink-muted">Seus treinos e o que você executa.</p>

      <div className="mt-8">
        <WorkoutDataProvider>
          <RoutineList />
        </WorkoutDataProvider>
      </div>
    </main>
  );
}
