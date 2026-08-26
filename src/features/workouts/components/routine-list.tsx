"use client";

import { cn } from "@/design-system/cn";
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

import { useRoutineList } from "../hooks/use-routine-list";
import { useSessionHistory } from "../hooks/use-session-history";
import { useTicker } from "../hooks/use-ticker";
import {
  executionTrail,
  TRAIL_WEEKS,
  type ExecutionTrail,
} from "../services/history";
import type { Routine } from "../types/routine";
import { InProgressBanner } from "./in-progress-banner";

export function RoutineList() {
  // The same provider the resume banner already reads from, so the history
  // arrives without a new hook, a new query or a new shape of data.
  const history = useSessionHistory();
  const sessions = history.status === "ready" ? history.sessions : [];
  // Through the ticker rather than `Date.now()` in the body: reading the clock
  // during render is impure and the lint rule that says so is right. One read
  // per render, not one per row, or each routine would anchor its marks to a
  // slightly different "now". An hour is far finer than a trail measured in
  // weeks needs, and it costs one timer on a screen that already runs one.
  const now = useTicker(true, 60 * 60 * 1000);
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

  /**
   * **Space does the grouping, and the gaps are uneven on purpose.**
   *
   * The create form sits close to the title above it — they are one moment,
   * the screen's action — and the list sits further away, because it is the
   * answer rather than part of the question. Even spacing said "these are
   * three peers"; uneven spacing says which two belong together, without a
   * single border being drawn.
   */
  return (
    <div>
      {/* Still above everything: a workout left open is the most urgent thing
          on this screen. What changed is what it costs — see the note in
          `InProgressBanner`. */}
      <InProgressBanner />

      <form
        onSubmit={(event) => void handleCreate(event)}
        className="mt-3 flex gap-2"
      >
        {/* `defaultValue`, não `value`: um campo controlado é reconciliado
            na hidratação, e o React sobrescreve o valor real do DOM de
            volta pro estado inicial ("") — apagando em silêncio o que foi
            digitado rápido, antes do JS assumir. Sem `value` amarrado,
            a hidratação nunca toca o campo; `onChange` continua
            atualizando `name` normalmente para o botão e o envio. */}
        <Input
          defaultValue={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Treino A"
          aria-label="Nome do novo treino"
          autoComplete="off"
        />
        {/* Same pairing as `/dietas`: the field sets the height, not the
            button. See the note there. */}
        <Button type="submit" pending={creating} disabled={name.trim() === ""}>
          <Plus aria-hidden className="size-4" />
          Criar
        </Button>
      </form>

      {writeError !== null && (
        <p role="alert" className={cn("mt-4", noticeClasses())}>
          {writeError}
        </p>
      )}

      <div className="mt-7">
        {state.status === "loading" && <ListSkeleton />}

      {state.status === "error" && (
        <div role="alert" className={noticeClasses("danger", "block")}>
          <p className="text-ink">Não foi possível carregar seus treinos.</p>
          <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.status === "ready" &&
        (state.routines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
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
                trail={executionTrail(sessions, routine.id, now)}
                onDuplicate={() => void duplicate(routine)}
                onRemove={() => void remove(routine)}
              />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/**
 * When this routine was actually trained, drawn in real time.
 *
 * **Every mark is a session that happened.** Nothing is drawn for a routine
 * never executed — the line stays empty and the words say so, the same
 * discipline that kept the calorie ring from faking an arc on a fresh morning.
 * A routine done three times in ten days and one abandoned two months ago carry
 * the same name and the same structure; the spacing is the only thing that
 * tells them apart, which is why the positions are real and not distributed.
 *
 * The line is 1px and the marks are 6px on purpose. With a single execution
 * this has to read as one quiet fact, not as a chart with one bar — the failure
 * the volume graph already demonstrated.
 *
 * `role="img"` with the full sentence, because the marks are a picture of
 * something the sighted reader gets from position alone. The visible text
 * beside it carries the fact that matters most either way.
 */
function ExecutionTrail({ trail }: { readonly trail: ExecutionTrail }) {
  const label =
    trail.countInWindow === 0
      ? `Nenhuma execução nas últimas ${String(TRAIL_WEEKS)} semanas.`
      : `${String(trail.countInWindow)} ${trail.countInWindow === 1 ? "execução" : "execuções"} nas últimas ${String(TRAIL_WEEKS)} semanas.`;

  return (
    <div className="mt-2 flex items-center gap-3">
      <div role="img" aria-label={label} className="relative h-1.5 flex-1">
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line"
        />
        {trail.marks.map((ratio, index) => (
          <span
            key={index}
            aria-hidden
            style={{ left: `${String(ratio * 100)}%` }}
            className={cn(
              "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              // Only the newest carries the brand. One emerald point per
              // routine marks "the latest" and keeps the colour concentrated;
              // every mark in accent would scatter it down the whole list.
              index === trail.marks.length - 1 ? "bg-accent" : "bg-ink-subtle",
            )}
          />
        ))}
      </div>

      {/* The date rides with the track rather than on the structure line
          above. Joined to "3 exercícios · 9 séries" it pushed that line to two
          and sometimes three wraps at 320px — "ainda não / executado" broke
          mid-phrase — and it belongs next to the marks it explains anyway. */}
      <span className="shrink-0 text-[0.6875rem] whitespace-nowrap text-ink-subtle">
        {trail.lastAt === null ? "nunca executado" : formatWhen(trail.lastAt)}
      </span>
    </div>
  );
}

function RoutineRow({
  routine,
  trail,
  onDuplicate,
  onRemove,
}: {
  readonly routine: Routine;
  readonly trail: ExecutionTrail;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}) {
  const exercises = routine.exercises.length;
  const sets = routine.exercises.reduce((sum, e) => sum + e.sets.length, 0);

  return (
    <Card
      as="li"
      padded={false}
      className="group transition-colors duration-150 ease-out hover:border-line-strong"
    >
      <Link
        href={`/treinos/${routine.id}`}
        className="flex items-center gap-4 p-4"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">
            {routine.name === "" ? "Treino sem nome" : routine.name}
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {exercises === 0
              ? "Nenhum exercício ainda"
              : `${exercises} ${exercises === 1 ? "exercício" : "exercícios"} · ${sets} ${sets === 1 ? "série" : "séries"}`}
          </p>

          <ExecutionTrail trail={trail} />
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
          className="flex size-8 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
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

const whenFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

/** `12 de ago.` — short, because it rides on an already dense meta line. */
function formatWhen(timestamp: number): string {
  return whenFormatter.format(new Date(timestamp));
}
