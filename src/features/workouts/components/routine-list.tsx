"use client";

import { Skeleton } from "@/design-system/components/skeleton";
import { Copy, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Input } from "@/design-system/components/input";

import { useRoutineList } from "../hooks/use-routine-list";
import type { Routine } from "../types/routine";
import { InProgressBanner } from "./in-progress-banner";

export function RoutineList() {
  const router = useRouter();
  const { state, writeError, create, duplicate, remove } = useRoutineList();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === "") return;

    setCreating(true);
    const id = await create(name);
    setCreating(false);

    // Straight into the builder: creating a routine and then hunting for it in
    // a list is two steps where the intent was one.
    if (id !== null) router.push(`/treinos/${id}`);
  }

  return (
    <div className="space-y-5">
      {/* Above everything: a workout left open is the most urgent thing on
          this screen, and until now it was unreachable. */}
      <InProgressBanner />

      <form onSubmit={(event) => void handleCreate(event)} className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Treino A"
          aria-label="Nome do novo treino"
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
          <p className="text-ink">Não foi possível carregar seus treinos.</p>
          <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.status === "ready" &&
        (state.routines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
            <p className="text-ink">Nenhum treino ainda.</p>
            <p className="mt-1.5 text-sm text-ink-subtle">
              Dê um nome acima e comece a montar.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {state.routines.map((routine) => (
              <RoutineRow
                key={routine.id}
                routine={routine}
                onDuplicate={() => void duplicate(routine)}
                onRemove={() => void remove(routine)}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}

function RoutineRow({
  routine,
  onDuplicate,
  onRemove,
}: {
  readonly routine: Routine;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}) {
  const exercises = routine.exercises.length;
  const sets = routine.exercises.reduce((sum, e) => sum + e.sets.length, 0);

  return (
    <li className="group relative rounded-xl border border-line bg-surface transition-colors duration-150 ease-out hover:border-line-strong">
      <Link href={`/treinos/${routine.id}`} className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">
            {routine.name === "" ? "Treino sem nome" : routine.name}
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {exercises === 0
              ? "Nenhum exercício ainda"
              : `${exercises} ${exercises === 1 ? "exercício" : "exercícios"} · ${sets} ${sets === 1 ? "série" : "séries"}`}
          </p>
        </div>
        <span className="w-16 shrink-0" />
      </Link>

      {/* Outside the link: buttons nested in an anchor are invalid and eat the
          click on the row. */}
      <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center">
        <button
          type="button"
          onClick={onDuplicate}
          aria-label={`Duplicar ${routine.name}`}
          className="flex size-8 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
        >
          <Copy aria-hidden className="size-4" />
        </button>

        <ConfirmButton
          onConfirm={onRemove}
          label={`Excluir ${routine.name}`}
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
