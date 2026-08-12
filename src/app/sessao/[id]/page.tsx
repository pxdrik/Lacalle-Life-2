import type { Metadata } from "next";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { SessionRunner } from "@/features/workouts/components/session-runner";

/**
 * Deliberately neutral.
 *
 * This route serves a workout being executed *and* the summary of one that
 * finished weeks ago, and the title is static metadata resolved on the
 * server — which cannot know which. "Treino em andamento" on a session
 * closed last month is the page telling a small lie in the one place a
 * person keeps many tabs.
 */
export const metadata: Metadata = {
  title: "Treino · LaCalle Life",
};

export default async function SessionPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-6xl px-6 py-6 sm:py-10">
      <WorkoutDataProvider>
        <SessionRunner sessionId={id} />
      </WorkoutDataProvider>
    </main>
  );
}
