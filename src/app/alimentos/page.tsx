import type { Metadata } from "next";

import { FoodDataProvider } from "@/composition/data-providers";
import { FoodBrowser } from "@/features/foods/components/food-browser";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Alimentos · LaCalle Life",
};

export default function FoodsPage() {
  return (
    <PageShell>
      <PageHeader
        icon={ICONS.foods}
        title="Alimentos"
        subtitle="O banco que suas dietas usam."
      />

      <div className="mt-8">
        <FoodDataProvider>
          <FoodBrowser />
        </FoodDataProvider>
      </div>
    </PageShell>
  );
}
