import type { Metadata } from "next";
import { Suspense } from "react";

import { FoodLogDataProvider } from "@/composition/data-providers";
import { SelectFoodRoute } from "./select-food-route";
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
        {/* O diário também (roadmap 7.2): os recentes vêm dele. */}
        <FoodLogDataProvider>
          <SelectFoodRoute />
        </FoodLogDataProvider>
      </Suspense>
    </PageShell>
  );
}
