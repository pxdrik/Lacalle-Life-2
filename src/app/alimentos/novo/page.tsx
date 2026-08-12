import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FoodDataProvider } from "@/composition/data-providers";
import { FoodEditorScreen } from "@/features/foods/components/food-editor-screen";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";

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

      <PageHeader
        icon={ICONS.foods}
        title="Novo alimento"
        subtitle="Para o que o banco não tem — seu suplemento, a marca que você compra, a receita da sua casa."
        className="mt-4"
      />

      <div className="mt-8">
        <FoodDataProvider>
          <FoodEditorScreen id={null} />
        </FoodDataProvider>
      </div>
    </main>
  );
}
