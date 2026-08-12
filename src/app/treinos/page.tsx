import type { Metadata } from "next";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { RoutineList } from "@/features/workouts/components/routine-list";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";

export const metadata: Metadata = {
  title: "Treinos · LaCalle Life",
};

export default function WorkoutsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <PageHeader
        icon={ICONS.workouts}
        title="Treinos"
        subtitle="Seus treinos e o que você executa."
      />

      <div className="mt-8">
        <WorkoutDataProvider>
          <RoutineList />
        </WorkoutDataProvider>
      </div>
    </main>
  );
}
