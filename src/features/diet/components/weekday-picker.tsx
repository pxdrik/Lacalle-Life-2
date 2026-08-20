"use client";

import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { cn } from "@/design-system/cn";

import {
  getTrainingDays,
  setTrainingDays,
} from "../data/training-days-store";
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT_LABELS,
  WEEKDAYS,
  WEEKEND_DAYS,
} from "../services/diet-schedule";
import type { Weekday } from "../types/diet";

interface Props {
  readonly open: boolean;
  readonly dietName: string;
  readonly selected: readonly Weekday[];
  readonly onSave: (weekdays: readonly Weekday[]) => void;
  readonly onClose: () => void;
}

/**
 * Which days of the week a diet is the plan for.
 *
 * A modal, not an inline panel: nothing on the list behind changes while
 * this is open, and the choice is narrow-then-confirm — the split `Dialog`
 * itself documents.
 */
export function WeekdayPicker({
  open,
  dietName,
  selected,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<readonly Weekday[]>(selected);
  // Read fresh each time the dialog opens rather than once at mount, so
  // saving a preset in one visit is there to use the next time it opens.
  const [trainingDays, setTrainingDaysState] = useState<readonly Weekday[]>(
    () => (typeof window === "undefined" ? [] : getTrainingDays()),
  );

  // The dialog is remounted fresh each `open`, so `draft` starting from
  // `selected` on every render would fight the user's own toggles. This
  // syncs only when the dialog transitions to open, the same technique
  // `GramsField` uses for "a change from elsewhere replaces the draft".
  const [syncedFor, setSyncedFor] = useState(open);
  if (open !== syncedFor) {
    setSyncedFor(open);
    if (open) {
      setDraft(selected);
      setTrainingDaysState(getTrainingDays());
    }
  }

  function toggle(day: Weekday) {
    setDraft((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  return (
    <Dialog open={open} title={`Dias de "${dietName}"`} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-ink-subtle">
          O Diário sugere essa dieta nos dias marcados. Um dia só pode
          apontar para uma dieta — marcar aqui desmarca de qualquer outra.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => {
            const active = draft.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={WEEKDAY_LABELS[day]}
                onClick={() => {
                  toggle(day);
                }}
                className={cn(
                  "flex h-10 min-w-11 items-center justify-center rounded-md border px-2 text-sm font-medium",
                  "transition-colors duration-150 ease-out",
                  active
                    ? "border-accent bg-accent-surface text-accent-text"
                    : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {WEEKDAY_SHORT_LABELS[day]}
              </button>
            );
          })}
        </div>

        {/* Atalhos — nunca a única forma de escolher, só um jeito mais
            rápido de chegar num padrão comum. */}
        <div className="flex flex-wrap gap-2">
          <ShortcutButton
            label="Fim de semana"
            onClick={() => {
              setDraft(WEEKEND_DAYS);
            }}
          />
          {trainingDays.length > 0 && (
            <>
              <ShortcutButton
                label="Dias de treino"
                onClick={() => {
                  setDraft(trainingDays);
                }}
              />
              <ShortcutButton
                label="Dias sem treino"
                onClick={() => {
                  setDraft(WEEKDAYS.filter((d) => !trainingDays.includes(d)));
                }}
              />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setTrainingDays(draft);
            setTrainingDaysState(draft);
          }}
          disabled={draft.length === 0}
          className="text-xs text-ink-subtle underline underline-offset-4 hover:text-ink disabled:pointer-events-none disabled:no-underline disabled:opacity-50"
        >
          Salvar seleção atual como &quot;dias de treino&quot;
        </button>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ShortcutButton({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
    >
      {label}
    </button>
  );
}
