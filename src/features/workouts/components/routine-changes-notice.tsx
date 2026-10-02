"use client";

import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";

import { describeRoutineDays } from "@/core/domain/weekday";
import { formatDecimal } from "@/core/format/decimal";
import { Dialog } from "@/design-system/components/dialog";

import { compareRoutines, type ExerciseDetail, type RoutineChange } from "../services/routine-changes";
import type { PrescribedRoutine } from "../types/prescribed-routine";

/**
 * Versão nova do treino, no cartão de Treinos (Etapa 8f, protótipo aprovado
 * em 01/10/2026): o aviso e, num toque, o que mudou, com a nota do treinador
 * e a comparação com a versão anterior. Abrir conta como ter visto a versão
 * (`onSeen`), como abrir o treino. O mesmo desenho do aviso do plano em Dietas.
 */
export function RoutineChangesNotice({ routine, onSeen }: { readonly routine: PrescribedRoutine; readonly onSeen: () => void }) {
  const [open, setOpen] = useState(false);
  const changes =
    routine.previous === null
      ? null
      : compareRoutines(routine.previous.exercises, routine.exercises, {
          before: routine.previous.weekdays,
          after: routine.weekdays,
        });

  return (
    <div className="px-4 pb-3">
      <div className="flex items-start gap-2 rounded-lg bg-warning-surface px-3 py-2 text-sm text-ink">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text" />
        <div className="min-w-0 break-words">
          <p>{routine.professionalName} atualizou seu treino. Os treinos que você já fez continuam como estavam.</p>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              onSeen();
            }}
            className="mt-1 flex min-h-11 items-center font-medium text-accent-text underline-offset-4 hover:underline"
          >
            Ver o que mudou
          </button>
        </div>
      </div>

      <Dialog
        open={open}
        title={`O que mudou na versão ${String(routine.version)}`}
        onClose={() => {
          setOpen(false);
        }}
        placement="sheet-bottom"
      >
        {routine.changeNote !== "" && (
          <p className="text-sm break-words text-ink-muted">
            Nota de {routine.professionalName}: “{routine.changeNote}”
          </p>
        )}
        {changes === null ? (
          <p className="mt-3 text-sm text-ink-muted">A versão anterior não está neste aparelho para comparar.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {changes.length === 0 && (
              <li className="py-2.5 text-sm text-ink-muted">Os exercícios, as séries e os dias não mudaram.</li>
            )}
            {changes.map((change, index) => (
              // A comparação devolve uma lista fixa, sem reordenar: o índice é estável.
              <li key={index} className="py-2.5 text-sm break-words text-ink">
                <p className="font-medium">{title(change)}</p>
                <p className="mt-0.5 text-ink-muted">{body(change)}</p>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}

function title(change: RoutineChange): string {
  return change.kind === "days" ? "Dias do treino" : change.exercise;
}

function body(change: RoutineChange): ReactNode {
  switch (change.kind) {
    case "days":
      return <Delta from={describeRoutineDays(change.from)} to={describeRoutineDays(change.to)} />;
    case "added":
      return `Entrou, ${plural(change.sets, "série", "séries")}${change.reps === null ? "" : ` de ${String(change.reps)}`}`;
    case "removed":
      return "Saiu do treino";
    case "changed":
      return change.details.map((detail, index) => (
        // Mesma lista fixa da comparação.
        <span key={index}>
          {index > 0 && ", "}
          {describeDetail(detail)}
        </span>
      ));
  }
}

const dash = (value: number | null, show: (n: number) => string) => (value === null ? "—" : show(value));
const kg = (value: number) => `${formatDecimal(value)} kg`;
const minutes = (s: number) => `${formatDecimal(s / 60)} min`;
const seconds = (s: number) => `${String(s)} seg`;
const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

function describeDetail(detail: ExerciseDetail): ReactNode {
  switch (detail.kind) {
    case "replaced":
      return `no lugar de ${detail.from}`;
    case "sets":
      return <Delta from={dash(detail.from, (n) => plural(n, "série", "séries"))} to={dash(detail.to, (n) => plural(n, "série", "séries"))} />;
    case "weight":
      return <Delta from={dash(detail.from, kg)} to={dash(detail.to, kg)} />;
    case "reps":
      return <Delta from={dash(detail.from, (n) => plural(n, "repetição", "repetições"))} to={dash(detail.to, (n) => plural(n, "repetição", "repetições"))} />;
    case "rpe":
      return (
        <>
          RPE <Delta from={dash(detail.from, String)} to={dash(detail.to, String)} />
        </>
      );
    case "duration":
      return <Delta from={dash(detail.from, minutes)} to={dash(detail.to, minutes)} />;
    case "targets":
      return "as metas das séries mudaram";
    case "rest":
      return (
        <>
          descanso <Delta from={dash(detail.from, seconds)} to={dash(detail.to, seconds)} />
        </>
      );
    case "notes":
      return "a observação mudou";
  }
}

/**
 * Antes riscado, depois em seguida, como no protótipo; o leitor de tela ouve
 * "para". A seta não se separa do valor novo: a linha quebra antes dela.
 */
function Delta({ from, to }: { readonly from: string; readonly to: string }) {
  return (
    <>
      <s className="text-ink-subtle">{from}</s>{" "}
      <span className="whitespace-nowrap">
        <span aria-hidden>→</span>
        <span className="sr-only">para</span> {to}
      </span>
    </>
  );
}
