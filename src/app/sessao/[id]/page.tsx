import type { Metadata } from "next";

import { WorkoutDataProvider } from "@/composition/data-providers";
import { SessionRunner } from "@/features/workouts/components/session-runner";

export const metadata: Metadata = {
  title: "Treino em andamento · Lacalle Life",
};

export default async function SessionPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 sm:py-10">
      <WorkoutDataProvider>
        <SessionRunner sessionId={id} />
      </WorkoutDataProvider>
    </main>
  );
}
