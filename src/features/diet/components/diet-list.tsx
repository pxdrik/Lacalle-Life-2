"use client";

import { Skeleton } from "@/design-system/components/skeleton";
import { Copy, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Input } from "@/design-system/components/input";

import { useDietList } from "../hooks/use-diet-list";
import { dietMacros } from "../services/diet-macros";
import type { Diet } from "../types/diet";
import { MacroSummary } from "./macro-summary";

export function DietList() {
  const router = useRouter();
  const { state, writeError, create, duplicate, remove } = useDietList();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === "") return;

    setCreating(true);
    const id = await create(name);
    setCreating(false);

    // Straight into the editor: creating a diet and then having to find it in
    // a list is two steps where the intent was one.
    if (id !== null) router.push(`/dietas/${id}`);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={(event) => void handleCreate(event)} className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Nome da nova dieta"
          aria-label="Nome da nova dieta"
          autoComplete="off"
        />
        <Button type="submit" size="lg" pending={creating} disabled={name.trim() === ""}>
          <Plus aria-hidden className="size-4" />
          Criar
        </Button>
      </form>

      {writeError !== null && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink"
        >
          {writeError}
        </p>
      )}

      {state.status === "loading" && <ListSkeleton />}

      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/5 px-6 py-8 text-center"
        >
          <p className="text-ink">Não foi possível carregar suas dietas.</p>
          <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.status === "ready" &&
        (state.diets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
            <p className="text-ink">Nenhuma dieta ainda.</p>
            <p className="mt-1.5 text-sm text-ink-subtle">
              Dê um nome acima e comece a montar.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {state.diets.map((diet) => (
              <DietRow
                key={diet.id}
                diet={diet}
                onDuplicate={() => void duplicate(diet)}
                onRemove={() => void remove(diet)}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}

function DietRow({
  diet,
  onDuplicate,
  onRemove,
}: {
  readonly diet: Diet;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}) {
  const macros = dietMacros(diet);
  const meals = diet.meals.length;

  return (
    <li className="group relative rounded-xl border border-line bg-surface transition-colors duration-150 ease-out hover:border-line-strong">
      <Link href={`/dietas/${diet.id}`} className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">
            {diet.name === "" ? "Dieta sem nome" : diet.name}
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {meals} {meals === 1 ? "refeição" : "refeições"}
          </p>
        </div>
        <div className="hidden shrink-0 sm:block">
          <MacroSummary macros={macros} />
        </div>
        <span className="w-16 shrink-0" />
      </Link>

      {/* Outside the link: buttons nested in an anchor are invalid and swallow
          the click on the row. */}
      <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center">
        <button
          type="button"
          onClick={onDuplicate}
          aria-label={`Duplicar ${diet.name}`}
          className="flex size-8 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
        >
          <Copy aria-hidden className="size-4" />
        </button>

        <ConfirmButton
          onConfirm={onRemove}
          label={`Excluir ${diet.name}`}
          confirmLabel="Excluir?"
          className="h-8 min-w-8"
        >
          <Trash2 aria-hidden className="size-4" />
        </ConfirmButton>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden className="space-y-2">
      {[0, 1, 2].map((index) => (
        <li key={index}>
          <Skeleton className="h-[4.5rem] rounded-xl" />
        </li>
      ))}
    </ul>
  );
}
