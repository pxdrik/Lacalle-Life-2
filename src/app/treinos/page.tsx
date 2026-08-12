import type { Metadata } from "next";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { RoutineList } from "@/features/workouts/components/routine-list";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Treinos · LaCalle Life",
};

export default function WorkoutsPage() {
  return (
    <PageShell>
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
    </PageShell>
  );
}
