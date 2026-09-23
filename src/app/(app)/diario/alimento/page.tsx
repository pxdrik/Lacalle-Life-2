import type { Metadata } from "next";
import { Suspense } from "react";

import { FoodLogDataProvider } from "@/composition/data-providers";
import { MealItemDetailScreen } from "@/features/diet/components/meal-item-detail-screen";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Alimento · LaCalle Life",
};

/**
 * RM02 (roadmap 23/09/2026): "abrir a PÁGINA PRÓPRIA DE DETALHES/EDIÇÃO do
 * alimento" — clicando num alimento dentro de uma refeição do Diário.
 *
 * `dia`/`mealId`/`itemId` chegam pela URL, mesmo desenho de
 * `/alimentos/selecionar` — `MealItemDetailScreen` é quem os lê
 * (`useSearchParams`), daí o `Suspense`.
 */
export default function MealItemDetailPage() {
  return (
    <PageShell padding="tight">
      <Suspense fallback={null}>
        <FoodLogDataProvider>
          <MealItemDetailScreen />
        </FoodLogDataProvider>
      </Suspense>
    </PageShell>
  );
}
