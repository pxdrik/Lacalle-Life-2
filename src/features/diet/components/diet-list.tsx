"use client";

import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";
import { Copy, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
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
      <form
        onSubmit={(event) => void handleCreate(event)}
        className="flex gap-2"
      >
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Nome da nova dieta"
          aria-label="Nome da nova dieta"
          autoComplete="off"
        />
        {/* Default size, not `lg`: this button is half of a pair with the
            field beside it, and `lg` made it 46px against the field's 40px —
            six pixels hanging below the thing it belongs to. The CTA is
            unmistakable because it is the only filled control on the screen,
            not because it is taller than its own input. */}
        <Button type="submit" pending={creating} disabled={name.trim() === ""}>
          <Plus aria-hidden className="size-4" />
          Criar
        </Button>
      </form>

      {writeError !== null && (
        <p role="alert" className={noticeClasses()}>
          {writeError}
        </p>
      )}

      {state.status === "loading" && <ListSkeleton />}

      {state.status === "error" && (
        <div role="alert" className={noticeClasses("danger", "block")}>
          <p className="text-ink">Não foi possível carregar suas dietas.</p>
          <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.status === "ready" &&
        (state.diets.length === 0 ? (
          <Card tone="quiet" className="text-center">
            <p className="text-ink">Nenhuma dieta ainda.</p>
            <p className="mt-1.5 text-sm text-ink-subtle">
              Dê um nome acima e comece a montar.
            </p>
          </Card>
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
    <Card
      as="li"
      padded={false}
      className="group transition-colors duration-150 ease-out hover:border-line-strong"
    >
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
          className="flex size-8 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
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
    </Card>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden className="space-y-2">
      {[0, 1, 2].map((index) => (
        <li key={index}>
          <Skeleton className="h-[4.5rem] rounded-lg" />
        </li>
      ))}
    </ul>
  );
}
