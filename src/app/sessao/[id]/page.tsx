import type { Metadata } from "next";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { SessionRunner } from "@/features/workouts/components/session-runner";
import { PageShell } from "@/design-system/components/page-shell";

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
    <PageShell padding="tight">
      <WorkoutDataProvider>
        <SessionRunner sessionId={id} />
      </WorkoutDataProvider>
    </PageShell>
  );
}
