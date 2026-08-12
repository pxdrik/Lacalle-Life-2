import type { Metadata } from "next";
import { Suspense } from "react";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { RoutineEditor } from "@/features/workouts/components/routine-editor";

export const metadata: Metadata = {
  title: "Treino · LaCalle Life",
};

/**
 * The id exists only in the visitor's browser, so there is nothing for the
 * server to look up — it renders the shell and the editor reads local storage
 * after mount.
 */
export default async function RoutinePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      {/* The exercise picker reads search params, so it needs a boundary for
          the shell to stay prerenderable. */}
      <Suspense fallback={null}>
        <WorkoutDataProvider>
          <RoutineEditor routineId={id} />
        </WorkoutDataProvider>
      </Suspense>
    </main>
  );
}
