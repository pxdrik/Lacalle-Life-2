import type { Metadata } from "next";

import {
  BodyDataProvider,
  DietAdherenceDataProvider,
  WorkoutDataProvider,
} from "@/composition/data-providers";
import { BodyScreen } from "@/features/body/components/body-screen";
import { DietAdherenceSection } from "@/features/diet/components/diet-adherence-section";
import { EvolutionScreen } from "@/features/workouts/components/evolution-screen";
import { ErrorBoundary } from "@/design-system/components/error-boundary";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { PageShell } from "@/design-system/components/page-shell";
import { Section } from "@/design-system/components/section";

import { BodyEntrySyncStatus } from "./body-entry-sync-status";

export const metadata: Metadata = {
  title: "Evolução · LaCalle Life",
};

/**
 * The three parts of "acompanhar evolução", composed at the route.
 *
 * The body comes first because it is the question people open this page to
 * ask, and because it is the only feedback the diet ever gets: targets are
 * calculated from a weight, and without this section nobody ever finds out
 * whether the weight moved.
 *
 * Composed here rather than one feature importing another — none of the
 * three knows the others exist, which is what keeps them independently
 * removable.
 */
export default function EvolutionPage() {
  return (
    <PageShell>
      <PageHeader
        icon={ICONS.progress}
        title="Evolução"
        subtitle="Seu corpo, seus treinos e sua dieta, ao longo do tempo."
      />

      <div className="mt-8">
        <BodyDataProvider>
          <div className="mb-4">
            <BodyEntrySyncStatus />
          </div>
          {/* Isolated from the workout half below: a corrupted body record
              must not take the whole page down with it. See the doc comment
              on `ErrorBoundary` for why this exists. */}
          <ErrorBoundary message="Não foi possível exibir seus dados de peso e medidas. O restante da página continua funcionando.">
            <BodyScreen />
          </ErrorBoundary>
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

      <Section
        title="Dieta"
        subtitle="Quanto do plano você realmente segue."
        divider
      >
        {/* Mesmo isolamento do bloco de Peso acima: um bug aqui não deveria
            levar a página inteira, incluindo Treinos, junto. */}
        <ErrorBoundary message="Não foi possível exibir sua aderência à dieta. O restante da página continua funcionando.">
          <DietAdherenceDataProvider>
            <DietAdherenceSection />
          </DietAdherenceDataProvider>
        </ErrorBoundary>
      </Section>
    </PageShell>
  );
}
