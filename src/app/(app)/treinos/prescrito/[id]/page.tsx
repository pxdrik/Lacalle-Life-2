import type { Metadata } from "next";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { PrescribedRoutineScreen } from "@/features/workouts/components/prescribed-routine-screen";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Treino do treinador · LaCalle Life",
};

/** O treino recebido do Life Pro, só leitura. Vem do aparelho, como os treinos. */
export default async function PrescribedRoutinePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <WorkoutDataProvider>
        <PrescribedRoutineScreen routineId={id} />
      </WorkoutDataProvider>
    </PageShell>
  );
}
