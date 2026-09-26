"use client";

import { ChevronDown, ChevronUp, Plus, Repeat } from "lucide-react";

import { formatDecimal } from "@/core/format/decimal";

import type { PerformedSetChanges } from "../services/edit-session";
import type { LastPerformance } from "../services/history";
import type { Exercise } from "../types/exercise";
import type { SessionExercise } from "../types/session";
import { ExerciseIdentity } from "./exercise-identity";
import { PerformedSetRow } from "./performed-set-row";
import { Card } from "@/design-system/components/card";

interface Props {
  readonly exercise: SessionExercise;
  /** The catalogue entry behind `exerciseId`, when it could be resolved. */
  readonly catalogue: Exercise | undefined;
  readonly onOpenDetail: (exercise: Exercise) => void;
  readonly nextSetId: string | null;
  /** What was done the last time this exercise was trained, if ever. */
  readonly lastTime: LastPerformance | undefined;
  readonly onSetChange: (setId: string, changes: PerformedSetChanges) => void;
  readonly onToggleComplete: (setId: string) => void;
  readonly onRemoveSet: (setId: string) => void;
  readonly onAddSet: () => void;
  readonly onNotesChange: (notes: string) => void;
  /**
   * RM07 (roadmap 23/09/2026) — opens the picker to swap which exercise
   * fills this slot mid-workout. Absent in `SessionEditor`: editing a
   * finished workout corrects what was recorded, it does not change which
   * exercise it was.
   */
  readonly onSwap?: (() => void) | undefined;
  /** This exercise's place in the session, for the arrows' end states. */
  readonly position: number;
  readonly total: number;
  /**
   * Moves the exercise by `offset`. Absent in `SessionEditor` for the same
   * reason `onSwap` is: the order of a finished workout is a record of the
   * sequence it was done in, not something to rearrange afterwards.
   */
  readonly onMove?: ((offset: number) => void) | undefined;
}

export function SessionExerciseCard({
  exercise,
  catalogue,
  onOpenDetail,
  nextSetId,
  lastTime,
  onSetChange,
  onToggleComplete,
  onRemoveSet,
  onAddSet,
  onNotesChange,
  onSwap,
  position,
  total,
  onMove,
}: Props) {
  const isCardio = catalogue?.movementPattern === "cardio";
  const done = exercise.sets.filter((set) => set.isCompleted).length;
  const isComplete = done === exercise.sets.length && exercise.sets.length > 0;
  // The exercise holding the set someone is about to do — never more than one
  // at a time, because `nextIncompleteSet` in `session-runner.tsx` only ever
  // names one. Sprint 8: the same hero treatment `RoutineList` already gives
  // "rotina em andamento", carried into execution — the card someone is
  // actually standing in front of reads as the answer this screen exists to
  // give, not as one more box in a column of exercise cards.
  const isCurrent = nextSetId !== null;

  return (
    <Card as="section" tone={isCurrent ? "hero" : "default"}>
      {/* Thumbnail-sized and no larger. This card is read standing up between
          sets: a big photo here would push the set rows off the screen, which
          costs more than the photo adds. Tapping it opens the detail. */}
      <header className="flex items-center justify-between gap-3">
        <ExerciseIdentity
          name={exercise.name}
          catalogue={catalogue}
          onOpenDetail={onOpenDetail}
        >
          {exercise.restSeconds === null
            ? null
            : `Descanso de ${String(exercise.restSeconds)}s`}
        </ExerciseIdentity>
        {/* `gap-3`, não `gap-1`: cada `IconButton` desenha 32px e o
            utilitário `touch-44` estende a área de toque para 44px **fora do
            layout**. Com 4px de intervalo os centros ficam a 36px e os alvos
            se sobrepõem 8px, e sem `z-index` quem vence é o último do DOM —
            tocar na borda direita de "Trocar" dispararia "Mover para cima".
            Medido em `routine-exercise-card.tsx`, que tem a mesma fileira sem
            intervalo nenhum: os ~19% da direita de cada ícone disparam o
            vizinho. 12px é o que põe os centros a 44px e faz os alvos
            ladrilharem em vez de se empilharem. */}
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs tabular-nums text-ink-subtle">
            {done}/{exercise.sets.length}
            {isComplete && <span className="ml-1.5 text-accent-text">✓</span>}
          </span>
          {onSwap !== undefined && (
            <IconButton
              label={`Trocar ${exercise.name} por outro exercício`}
              disabled={done > 0}
              onClick={onSwap}
            >
              <Repeat aria-hidden className="size-4" />
            </IconButton>
          )}
          {/* As mesmas setas do editor de rotina, agora durante o treino:
              decidir no meio da sessão fazer o próximo exercício antes deste
              é reordenar o que falta, não corrigir o que já foi feito. Setas
              e não arrastar, pelo mesmo motivo que lá — uma tela usada com
              uma mão só, de pé. */}
          {onMove !== undefined && (
            <>
              <IconButton
                label={`Mover ${exercise.name} para cima`}
                disabled={position === 0}
                onClick={() => {
                  onMove(-1);
                }}
              >
                <ChevronUp aria-hidden className="size-4" />
              </IconButton>
              <IconButton
                label={`Mover ${exercise.name} para baixo`}
                disabled={position === total - 1}
                onClick={() => {
                  onMove(1);
                }}
              >
                <ChevronDown aria-hidden className="size-4" />
              </IconButton>
            </>
          )}
        </div>
      </header>

      {/* The question this app is opened to answer: what did I do last time.
          One compact line, above the sets, so it is read before the first rep
          and not hunted for afterwards. */}
      {lastTime !== undefined && (
        <p className="mt-1 truncate text-xs tabular-nums text-ink-muted">
          <span className="font-sans text-ink-subtle">
            Última vez, {formatShortDate(lastTime.performedAt)}:{" "}
          </span>
          {lastTime.sets.map(describeSet).join(" · ")}
        </p>
      )}

      {/* As colunas, declaradas **uma vez**, aqui. O cabeçalho logo abaixo e
          todas as linhas de série herdam `--set-cols` deste elemento e não
          declaram largura nenhuma — é isso que torna a divergência entre eles
          impossível por construção, em vez de por disciplina. O porquê inteiro
          está em `@utility set-grid`, em `globals.css`.

          Os números são físicos (a grade cancela o zoom da página), e o
          orçamento foi fechado pelo pior caso real, 320px na densidade
          Confortável, onde a linha tem 231px: as faixas fixas somam 112 e os
          dois campos pegam o que sobra dentro do seu `minmax`. O `max` existe
          para a tela larga não esticar campo numérico — o que sobra fica
          sobrando (`justify-content: start`). */}
      <div
        style={
          {
            // A primeira coluna é `minmax` pelo alvo de toque, não pelo
            // desenho: o número ocupa 24px, mas a coluna cresce até 44 onde
            // há espaço, e aí o gatilho das ações tem o alvo inteiro dentro
            // da própria coluna. Em 320px, onde a folga é exatamente zero,
            // ela fica nos 24 e o alvo sobra para a esquerda, sobre o padding
            // vazio do card. Medido: 360px para cima sobram de 19 a 92px.
            "--set-cols": isCardio
              ? "minmax(24px, 44px) minmax(72px, 112px) 44px"
              : "minmax(24px, 44px) minmax(52px, 68px) minmax(44px, 56px) 44px 44px",
          } as React.CSSProperties
        }
      >
        {/* `border-l-[3px] border-transparent` continua, agora só pelo que ele
            é: a calha onde a barra de foco de `PerformedSetRow` chega sem
            deslocar nada. O `px-1` que o acompanhava saiu — ele era offset
            copiado da linha para compensar 7px de desalinhamento, e a grade
            tornou a compensação desnecessária. */}
        <div
          aria-hidden
          className="mt-3 set-grid border-b border-line border-l-[3px] border-l-transparent pb-1.5 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
        >
          {/* Sem rótulo, só a coluna reservada. "Série" não cabia — medido,
              37,7px de texto numa caixa de 18,4px — e transbordava por cima de
              "PESO", que é o "texto série" que aparecia na tela. Uma coluna de
              números 1, 2, 3 à esquerda de "PESO" não precisa se apresentar. */}
          <span />
          {isCardio ? (
            <span className="text-center">Duração (min)</span>
          ) : (
            <>
              <span className="text-center">Peso</span>
              <span className="text-center">Reps</span>
            </>
          )}
          {!isCardio && <span className="text-center">RPE</span>}
          <span />
        </div>

        <ul className="mt-1">
          {exercise.sets.map((set, index) => (
            <PerformedSetRow
              key={set.id}
              set={set}
              index={index}
              exerciseName={exercise.name}
              isNext={set.id === nextSetId}
              isCardio={isCardio}
              onChange={(changes) => {
                onSetChange(set.id, changes);
              }}
              onToggleComplete={() => {
                onToggleComplete(set.id);
              }}
              onRemove={() => {
                onRemoveSet(set.id);
              }}
            />
          ))}
        </ul>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={onAddSet}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
        >
          <Plus aria-hidden className="size-4" />
          Série extra
        </button>

        <input
          type="text"
          value={exercise.notes}
          aria-label={`Observações de ${exercise.name}`}
          placeholder="Observações"
          onChange={(event) => {
            onNotesChange(event.target.value);
          }}
          className="min-w-40 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink-muted transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line focus:border-line-strong focus:bg-surface"
        />
      </div>
    </Card>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

function formatShortDate(timestamp: number): string {
  return shortDate.format(new Date(timestamp));
}

function describeSet(set: {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
}): string {
  if (set.durationSeconds !== null) {
    return `${formatDecimal(Math.round((set.durationSeconds / 60) * 10) / 10)} min`;
  }

  const reps = set.reps ?? "—";
  return set.weightKg === null
    ? `${String(reps)}`
    : `${String(reps)}×${formatDecimal(set.weightKg)}`;
}
