import type { Metadata } from "next";
import { Suspense } from "react";

import { FoodDataProvider } from "@/composition/data-providers";
import { FoodSelectionScreen } from "@/features/foods/components/food-selection-screen";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Adicionar alimento · LaCalle Life",
};

/**
 * Where "Adicionar alimento" navigates to now (17/09/2026) — a page, not the
 * dropdown that used to open inside the meal card. `returnTo`/`mealId` in
 * the query say where to come back to; `FoodSelectionScreen` owns the rest.
 *
 * `Suspense` because the screen reads `useSearchParams()`, same requirement
 * `/diario`'s `DayFromUrl` already has.
 */
export default function SelectFoodPage() {
  return (
    <PageShell>
      <Suspense fallback={null}>
        <FoodDataProvider>
          <FoodSelectionScreen />
        </FoodDataProvider>
      </Suspense>
    </PageShell>
  );
}
