import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FoodDataProvider } from "@/composition/data-providers";
import { FoodEditorScreen } from "@/features/foods/components/food-editor-screen";
import { PageHeader } from "@/design-system/components/page-header";

export const metadata: Metadata = {
  title: "Editar alimento · Lacalle Life",
};

/**
 * A route, for the same reasons `/alimentos/novo` is one: no focus trap, no
 * scroll lock, no fight with the phone keyboard, and the back button does the
 * obvious thing.
 *
 * Editing keeps the food's id, so a correction reaches every diet already
 * pointing at it. Before this route existed, fixing a typo meant deleting the
 * food and creating it again — which orphaned exactly those diets.
 */
export default async function EditFoodPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
        title="Editar alimento"
        subtitle="A correção vale para todas as dietas que usam este alimento daqui para frente."
        className="mt-4"
      />

      <div className="mt-8">
        <FoodDataProvider>
          <FoodEditorScreen id={id} />
        </FoodDataProvider>
      </div>
    </main>
  );
}
