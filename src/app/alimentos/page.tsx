import type { Metadata } from "next";

import { FoodBrowser } from "@/features/foods/components/food-browser";

export const metadata: Metadata = {
  title: "Alimentos · Lacalle Life",
};

export default function FoodsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Alimentos</h1>
      <p className="mt-1.5 text-ink-muted">
        O banco que suas dietas usam.
      </p>

      <div className="mt-8">
        <FoodBrowser />
      </div>
    </main>
  );
}
