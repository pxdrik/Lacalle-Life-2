import type { Metadata } from "next";

import {
  BodyDataProvider,
  WorkoutDataProvider,
} from "@/composition/data-providers";
import { BodyScreen } from "@/features/body/components/body-screen";
import { EvolutionScreen } from "@/features/workouts/components/evolution-screen";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { PageShell } from "@/design-system/components/page-shell";
import { Section } from "@/design-system/components/section";

export const metadata: Metadata = {
  title: "Evolução · LaCalle Life",
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
    <PageShell>
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

      {/* Sprint 8: this was the one place the app already drew a titled
          group with no card around it, written by hand. `Section` (the
          generalised version, now used across the app) replaces it with the
          same visual result — nothing here should look different. */}
      <Section
        title="Treinos"
        subtitle="O que você levantou, e como isso mudou."
        divider
      >
        <WorkoutDataProvider>
          <EvolutionScreen />
        </WorkoutDataProvider>
      </Section>
    </PageShell>
  );
}
