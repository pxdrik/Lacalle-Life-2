"use client";

import Link from "next/link";

import { Skeleton } from "@/design-system/components/skeleton";

import { useFoodEditor } from "../hooks/use-food-editor";
import { CustomFoodForm } from "./custom-food-form";

/**
 * The create and edit screens, which are the same screen.
 *
 * `id` of `null` means creating. Everything else — loading, the food not
 * existing, the food being a catalogue entry nobody may edit — is a state this
 * component owns so the form stays a form.
 */
export function FoodEditorScreen({ id }: { readonly id: string | null }) {
  const { state, save, pending, error } = useFoodEditor(id);

  if (state.status === "loading") {
    return (
      <div aria-hidden className="space-y-5">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Notice title="Não foi possível abrir este alimento.">
        {state.message}
      </Notice>
    );
  }

  if (state.status === "missing") {
    return (
      <Notice title="Este alimento não pode ser editado.">
        Ou ele foi excluído, ou é um item do banco original — esses são
        curados e ficam iguais para todo mundo. Crie o seu com os valores que
        você quiser.
      </Notice>
    );
  }

  return (
    <CustomFoodForm
      initial={state.food}
      save={save}
      pending={pending}
      error={error}
    />
  );
}

function Notice({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <p className="text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-subtle">{children}</p>
      <Link
        href="/alimentos"
        className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
      >
        Voltar para os alimentos
      </Link>
    </div>
  );
}
