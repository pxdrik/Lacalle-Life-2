import type { Metadata } from "next";

import {
  BodyDataProvider,
  WorkoutDataProvider,
} from "@/composition/data-providers";
import { BodyScreen } from "@/features/body/components/body-screen";
import { EvolutionScreen } from "@/features/workouts/components/evolution-screen";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";

export const metadata: Metadata = {
  title: "Evolução · Lacalle Life",
};

/**
 * The two halves of "acompanhar evolução", composed at the route.
 *
 * The body comes first because it is the question people open this page to
 * ask, and because it is the only feedback the diet ever gets: targets are
 * calculated from a weight, and without this section nobody ever finds out
 * whether the weight moved.
 *
 * Composed here rather than by one feature importing the other — neither
 * knows the other exists, which is what keeps them independently removable.
 */
export default function EvolutionPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <PageHeader
        icon={ICONS.progress}
        title="Evolução"
        subtitle="Seu corpo e seus treinos, ao longo do tempo."
      />

      <div className="mt-8">
        <BodyDataProvider>
          <BodyScreen />
        </BodyDataProvider>
      </div>

      <div className="mt-12 border-t border-line pt-10">
        <h2 className="text-lg font-semibold tracking-tight">Treinos</h2>
        <p className="mt-1 text-sm text-ink-muted">
          O que você levantou, e como isso mudou.
        </p>

        <div className="mt-6">
          <WorkoutDataProvider>
            <EvolutionScreen />
          </WorkoutDataProvider>
        </div>
      </div>
    </main>
  );
}
