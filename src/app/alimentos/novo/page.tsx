import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FoodDataProvider } from "@/composition/food-data-provider";
import { CustomFoodForm } from "@/features/foods/components/custom-food-form";

export const metadata: Metadata = {
  title: "Novo alimento · Lacalle Life",
};

/**
 * A route rather than a dialog.
 *
 * A page needs no focus trap, no scroll lock and no escape handling, it works
 * on a phone without fighting the keyboard, and the back button does the
 * obvious thing. A modal would have been more code for a worse result.
 */
export default function NewFoodPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10 sm:py-14">
      <Link
        href="/alimentos"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Alimentos
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Novo alimento
      </h1>
      <p className="mt-1.5 text-ink-muted">
        Para o que o banco não tem — seu suplemento, a marca que você compra, a
        receita da sua casa.
      </p>

      <div className="mt-8">
        <FoodDataProvider>
          <CustomFoodForm />
        </FoodDataProvider>
      </div>
    </main>
  );
}
