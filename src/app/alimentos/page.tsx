import type { Metadata } from "next";

import { FoodDataProvider } from "@/composition/data-providers";
import { FoodBrowser } from "@/features/foods/components/food-browser";
import { PageHeader } from "@/design-system/components/page-header";

export const metadata: Metadata = {
  title: "Alimentos · Lacalle Life",
};

export default function FoodsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <PageHeader title="Alimentos" subtitle="O banco que suas dietas usam." />

      <div className="mt-8">
        <FoodDataProvider>
          <FoodBrowser />
        </FoodDataProvider>
      </div>
    </main>
  );
}
