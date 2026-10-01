"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { WeekdayPicker } from "@/features/diet/components/weekday-picker";
import { describeWeekdays } from "@/features/diet/services/diet-schedule";
import type { Weekday } from "@/features/diet/types/diet";

import { useRoutineDraft } from "./routine-draft-context";

/** Sem dias, o paciente faz quando quiser (0038). */
export function describeRoutineDays(days: readonly Weekday[]): string {
  return days.length === 0 ? "Quando quiser" : describeWeekdays(days);
}

/**
 * Os dias do treino, abaixo do nome no editor do Life Pro (Etapa 8c). O
 * seletor de Dietas, sem os atalhos de "dias de treino" (seriam os do
 * treinador). Grava pelo rascunho, na mesma fila do editor.
 */
export function RoutineDraftDays() {
  const draft = useRoutineDraft();
  const [days, setDays] = useState<readonly Weekday[] | null>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([draft.weekdays(), draft.listAll()])
      .then(([loaded, [routine]]) => {
        if (!active) return;
        setDays(loaded);
        setName(routine?.name ?? "");
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [draft]);

  if (days === null) return failed ? <p className="mt-1 text-sm text-danger-text">Não foi possível ler os dias do treino.</p> : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void draft.listAll().then(([routine]) => {
            setName(routine?.name ?? "");
          });
          setOpen(true);
        }}
        className="mt-1 -ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
      >
        <CalendarDays aria-hidden className="size-4 shrink-0" />
        <span className="sr-only">Dias do treino:</span>
        {describeRoutineDays(days)}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-danger-text">
          Não foi possível salvar os dias. Confira a conexão e tente de novo.
        </p>
      )}
      <WeekdayPicker
        open={open}
        dietName={name === "" ? "Treino" : name}
        selected={days}
        description="A tela Hoje do paciente sugere este treino nos dias marcados. Sem nenhum dia, ele fica em Treinos, para fazer quando quiser. Mudar os dias entra na próxima versão publicada."
        trainingShortcuts={false}
        onSave={(next) => {
          setDays(next);
          setFailed(false);
          draft.setWeekdays(next).catch(() => {
            setFailed(true);
          });
        }}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
