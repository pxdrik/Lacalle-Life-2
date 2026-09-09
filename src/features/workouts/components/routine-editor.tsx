"use client";

import { cn } from "@/design-system/cn";
import { noticeClasses } from "@/design-system/components/notice";
import { PAGE_SHELL_BLEED } from "@/design-system/components/page-shell";
import { Skeleton } from "@/design-system/components/skeleton";
import { ArrowLeft, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import {
  SortableItem,
  SortableList,
} from "@/design-system/components/sortable-list";

import { useRoutineEditor } from "../hooks/use-routine-editor";
import {
  createRoutineExercise,
  duplicateRoutineExercise,
} from "../services/create-routine";
import {
  addExercise,
  addSet,
  moveExercise,
  removeExercise,
  removeSet,
  renameRoutine,
  reorderExercises,
  replaceExercise,
  updateExercise,
  updateSet,
} from "../services/edit-routine";
import { useExerciseLookup } from "../hooks/use-exercise-lookup";
import { ExerciseBrowser } from "./exercise-browser";
import {
  ExerciseDetailDialog,
  useExerciseDetail,
} from "./exercise-detail-dialog";
import { RoutineExerciseCard } from "./routine-exercise-card";

export function RoutineEditor({ routineId }: { readonly routineId: string }) {
  const router = useRouter();
  const { state, saveError, apply, start } = useRoutineEditor(routineId);
  const catalogue = useExerciseLookup();
  const detail = useExerciseDetail();
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);
  // Só a ação de adicionar liga isto — nunca um efeito lido de `routine`,
  // que dispararia de novo em toda remontagem do editor. Um conjunto, não um
  // id só, porque o seletor agora confirma vários exercícios de uma vez.
  const [justAddedIds, setJustAddedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  // Id do slot sendo trocado, ou null. Mutuamente exclusivo com `picking`:
  // só uma folha de seleção de exercício fica aberta por vez.
  const [swappingId, setSwappingId] = useState<string | null>(null);

  if (state.status === "loading") return <EditorSkeleton />;

  if (state.status === "missing") {
    return (
      <Notice title="Este treino não existe.">
        Ele pode ter sido excluído, ou o link pode estar errado.
      </Notice>
    );
  }

  if (state.status === "error") {
    return (
      <Notice title="Não foi possível abrir o treino.">{state.message}</Notice>
    );
  }

  const { routine } = state;
  const totalSets = routine.exercises.reduce(
    (sum, e) => sum + e.sets.length,
    0,
  );

  return (
    <div>
      <Link
        href="/treinos"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Treinos
      </Link>

      <input
        type="text"
        value={routine.name}
        aria-label="Nome do treino"
        placeholder="Treino sem nome"
        onChange={(event) => {
          apply((current) => renameRoutine(current, event.target.value));
        }}
        className="-mx-1.5 mt-3 w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-2xl font-medium tracking-normal transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line focus:border-line-strong focus:bg-surface"
      />

      <div
        className={cn(
          PAGE_SHELL_BLEED,
          "sticky top-0 z-10 mt-4 flex items-center justify-between gap-4 border-b border-line bg-canvas/90 py-3 backdrop-blur",
        )}
      >
        <p className="text-sm text-ink-muted">
          {routine.exercises.length}{" "}
          {routine.exercises.length === 1 ? "exercício" : "exercícios"}
          <span className="mx-1.5 text-line-strong">·</span>
          {totalSets} {totalSets === 1 ? "série" : "séries"}
        </p>

        <Button
          size="sm"
          pending={starting}
          disabled={routine.exercises.length === 0}
          onClick={() => {
            setStarting(true);
            void start().then((sessionId) => {
              setStarting(false);
              if (sessionId !== null) router.push(`/sessao/${sessionId}`);
            });
          }}
        >
          <Play aria-hidden className="size-4" />
          Iniciar treino
        </Button>
      </div>

      {saveError !== null && (
        <p role="alert" className={cn("mt-4", noticeClasses())}>
          {saveError}
        </p>
      )}

      <SortableList
        ids={routine.exercises.map((exercise) => exercise.id)}
        describe={(id) =>
          routine.exercises.find((exercise) => exercise.id === id)?.name ??
          "exercício"
        }
        onReorder={(activeId, overId) => {
          apply((current) => reorderExercises(current, activeId, overId));
        }}
      >
        <div className="mt-5 space-y-3">
          {routine.exercises.map((exercise, index) => (
            <SortableItem key={exercise.id} id={exercise.id}>
              {(dragHandle) => (
                <RoutineExerciseCard
                  exercise={exercise}
                  catalogue={catalogue.get(exercise.exerciseId)}
                  onOpenDetail={detail.show}
                  position={index}
                  total={routine.exercises.length}
                  dragHandle={dragHandle}
                  onChange={(changes) => {
                    apply((current) =>
                      updateExercise(current, exercise.id, changes),
                    );
                  }}
                  onRemove={() => {
                    apply((current) => removeExercise(current, exercise.id));
                  }}
                  onDuplicate={() => {
                    apply((current) =>
                      duplicateRoutineExercise(current, exercise.id),
                    );
                  }}
                  onSwap={() => {
                    setPicking(false);
                    setSwappingId(exercise.id);
                  }}
                  onMove={(offset) => {
                    apply((current) =>
                      moveExercise(current, exercise.id, offset),
                    );
                  }}
                  onAddSet={() => {
                    apply((current) => addSet(current, exercise.id));
                  }}
                  onRemoveSet={(setId) => {
                    apply((current) => removeSet(current, exercise.id, setId));
                  }}
                  onSetChange={(setId, changes) => {
                    apply((current) =>
                      updateSet(current, exercise.id, setId, changes),
                    );
                  }}
                  justAdded={justAddedIds.has(exercise.id)}
                  onEntranceEnd={() => {
                    setJustAddedIds((current) => {
                      if (!current.has(exercise.id)) return current;
                      const next = new Set(current);
                      next.delete(exercise.id);
                      return next;
                    });
                  }}
                />
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            setPicking(true);
          }}
          className="inline-flex h-(--control-h-lg) w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
        >
          <Plus aria-hidden className="size-4" />
          Adicionar exercício
        </button>
      </div>

      {/* Achado de teste manual real (item de UX pedido depois das melhorias
          de dieta/alimentos/treino): um painel que crescia inline empurrava
          o treino inteiro para baixo pela altura do catálogo inteiro — a
          mesma razão que já tinha tirado o filtro de exercícios do fluxo
          normal (comentário em `exercise-browser.tsx`). Uma folha por cima
          de tudo, não uma terceira forma de painel: reusa exatamente o
          `Dialog` que o filtro e toda outra consulta do app já usam. */}
      {picking && (
        <Dialog
          open
          title="Adicionar exercício"
          onClose={() => {
            setPicking(false);
          }}
          placement="sheet-bottom"
        >
          {/* Múltiplo, não imediato: montar um treino do zero é
              normalmente vários exercícios seguidos, e fechar e reabrir a
              folha a cada um era exatamente o trabalho extra reclamado. */}
          <ExerciseBrowser
            persistQuery={false}
            autoFocus
            selectionMode="multiple"
            onConfirmSelection={(exercises) => {
              const created = exercises.map((exercise) =>
                createRoutineExercise({
                  exerciseId: exercise.id,
                  name: exercise.name,
                }),
              );
              setJustAddedIds(new Set(created.map((exercise) => exercise.id)));
              apply((current) =>
                created.reduce(
                  (routine, exercise) => addExercise(routine, exercise),
                  current,
                ),
              );
              setPicking(false);
            }}
          />
        </Dialog>
      )}

      {/* Trocar continua imediato e um-a-um: diferente de montar o treino do
          zero, substituir o exercício de um slot é uma escolha só — reusa o
          mesmo componente do fluxo de adicionar, `replaceExercise` em vez de
          `addExercise`, sem ligar o modo múltiplo. */}
      {swappingId !== null && (
        <Dialog
          open
          title={`Trocar ${
            routine.exercises.find((item) => item.id === swappingId)?.name ??
            "exercício"
          }`}
          onClose={() => {
            setSwappingId(null);
          }}
          placement="sheet-bottom"
        >
          <ExerciseBrowser
            persistQuery={false}
            autoFocus
            onSelect={(exercise) => {
              apply((current) =>
                replaceExercise(current, swappingId, {
                  exerciseId: exercise.id,
                  name: exercise.name,
                }),
              );
              setSwappingId(null);
            }}
          />
        </Dialog>
      )}

      <ExerciseDetailDialog control={detail} />
    </div>
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
    <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <p className="text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-subtle">{children}</p>
      <Link
        href="/treinos"
        className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
      >
        Voltar para os treinos
      </Link>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
