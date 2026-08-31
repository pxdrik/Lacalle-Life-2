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
    /* `tight`, and no subtitle. This is a screen you arrive at to *do*
       something, not one you arrive at already reading — and "Seus treinos e o
       que você executa" restated the title for anyone who had just tapped a tab
       labelled Treinos. Between the two, 40px of the 336 it took to reach the
       first workout.

       The subtitle is dropped here and nowhere else: the rule is contextual, so
       Perfil keeps its own, which does real work explaining that the whole
       screen is optional. */
    <PageShell padding="tight">
      <PageHeader icon={ICONS.workouts} title="Treinos" />

      <div className="mt-6">
        <WorkoutDataProvider>
          <RoutineList />
        </WorkoutDataProvider>
      </div>
    </PageShell>
  );
}
