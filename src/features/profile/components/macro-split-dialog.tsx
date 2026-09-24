"use client";

import { useState } from "react";

import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { MACRO_SPLIT_PRESETS, type MacroSplit } from "@/core/nutrition";
import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { MACRO_CODING } from "@/design-system/macros";

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  /** `undefined` means "automatic" — no split stored on the profile. */
  readonly current: MacroSplit | undefined;
  readonly onSelect: (split: MacroSplit | undefined) => void;
}

const PERCENT_FIELD = {
  proteinG: "proteinPercent",
  carbsG: "carbsPercent",
  fatG: "fatPercent",
} as const satisfies Record<(typeof MACRO_CODING)[number]["key"], keyof MacroSplit>;

/**
 * Picking how the day's calories split into protein/carb/fat, instead of
 * leaving it to `distribution.ts`'s priority algorithm.
 *
 * **Rows of plain numbers, never a donut.** The reference screenshot Pedro
 * shared draws a pie chart; this app already tried a colour bar in the same
 * spot for the meal card's macro total and pulled it back out — "mostra os
 * números mesmo, não esse graficozinho" (`docs/roadmap.md`). Same call here:
 * this is the one screen where somebody *picks* a split rather than reads
 * one, and a number is what a pick needs to be checked against.
 *
 * Tapping "Automático" or a preset commits immediately and closes, the same
 * one-tap-to-pick shape as every other selection sheet in the app.
 * "Personalizado" is the one row that cannot commit on tap — three numbers
 * have to be typed and sum to 100 first — so it expands in place instead and
 * waits for an explicit "Salvar".
 */
export function MacroSplitDialog({ open, onClose, current, onSelect }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(current));

  function close() {
    setCustomOpen(false);
    onClose();
  }

  function choose(split: MacroSplit | undefined) {
    onSelect(split);
    close();
  }

  const draftValues = {
    proteinPercent: parseDecimal(draft.proteinPercent),
    carbsPercent: parseDecimal(draft.carbsPercent),
    fatPercent: parseDecimal(draft.fatPercent),
  };
  const draftSum =
    (draftValues.proteinPercent ?? 0) +
    (draftValues.carbsPercent ?? 0) +
    (draftValues.fatPercent ?? 0);
  const draftComplete =
    draftValues.proteinPercent !== null &&
    draftValues.carbsPercent !== null &&
    draftValues.fatPercent !== null;
  const draftValid = draftComplete && Math.abs(draftSum - 100) < 0.5;

  const currentIsPreset =
    current !== undefined &&
    MACRO_SPLIT_PRESETS.some((preset) => sameSplit(current, preset));

  return (
    <Dialog
      open={open}
      title="Distribuição de macros"
      onClose={close}
      placement="sheet-bottom"
    >
      <div className="space-y-2">
        <SplitRow
          label="Automático"
          detail="Calculado pelo peso e objetivo do perfil"
          selected={current === undefined}
          onClick={() => {
            choose(undefined);
          }}
        />

        {MACRO_SPLIT_PRESETS.map((preset) => (
          <SplitRow
            key={preset.id}
            label={preset.label}
            detail={splitDetail(preset)}
            selected={current !== undefined && sameSplit(current, preset)}
            onClick={() => {
              choose({
                proteinPercent: preset.proteinPercent,
                carbsPercent: preset.carbsPercent,
                fatPercent: preset.fatPercent,
              });
            }}
          />
        ))}

        <SplitRow
          label="Personalizado"
          detail={
            customOpen
              ? undefined
              : "Escolha você mesmo os três percentuais"
          }
          selected={customOpen || (current !== undefined && !currentIsPreset)}
          onClick={() => {
            setCustomOpen(true);
          }}
        />

        {customOpen && (
          <div className="space-y-3 rounded-md border border-line p-3">
            <div className="grid grid-cols-3 gap-3">
              {MACRO_CODING.map((macro) => {
                const field = PERCENT_FIELD[macro.key];
                return (
                  <Field
                    key={macro.key}
                    id={`macro-split-${macro.key}`}
                    label={
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            macro.fill,
                          )}
                        />
                        {macro.short}
                      </>
                    }
                  >
                    {({ id }) => (
                      <Input
                        id={id}
                        inputMode="decimal"
                        value={draft[field]}
                        onChange={(event) => {
                          setDraft((previous) => ({
                            ...previous,
                            [field]: event.target.value,
                          }));
                        }}
                        placeholder="0"
                      />
                    )}
                  </Field>
                );
              })}
            </div>

            <p className="text-xs text-ink-subtle">
              {!draftComplete
                ? "Preencha os três percentuais."
                : draftValid
                  ? "Soma 100%."
                  : draftSum > 100
                    ? `Tire ${formatDecimal(draftSum - 100)}% de algum lugar.`
                    : `Faltam ${formatDecimal(100 - draftSum)}%.`}
            </p>

            <Button
              className="w-full"
              disabled={!draftValid}
              onClick={() => {
                if (!draftValid || !draftComplete) return;
                choose({
                  proteinPercent: draftValues.proteinPercent!,
                  carbsPercent: draftValues.carbsPercent!,
                  fatPercent: draftValues.fatPercent!,
                });
              }}
            >
              Salvar
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function SplitRow({
  label,
  detail,
  selected,
  onClick,
}: {
  readonly label: string;
  readonly detail: string | undefined;
  readonly selected: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors duration-150 ease-out",
        selected
          ? "border-accent bg-accent/10"
          : "border-line-strong hover:border-ink-subtle hover:bg-muted",
      )}
    >
      <span className="text-sm font-medium text-ink">{label}</span>
      {detail !== undefined && (
        <span className="mt-0.5 text-xs text-ink-subtle">{detail}</span>
      )}
    </button>
  );
}

function splitDetail(split: MacroSplit): string {
  return MACRO_CODING.map(
    (macro) => `${macro.short} ${formatDecimal(split[PERCENT_FIELD[macro.key]])}%`,
  ).join(" · ");
}

function sameSplit(a: MacroSplit, b: MacroSplit): boolean {
  return (
    a.proteinPercent === b.proteinPercent &&
    a.carbsPercent === b.carbsPercent &&
    a.fatPercent === b.fatPercent
  );
}

function draftFrom(split: MacroSplit | undefined): Record<keyof MacroSplit, string> {
  return {
    proteinPercent: split === undefined ? "" : formatDecimal(split.proteinPercent),
    carbsPercent: split === undefined ? "" : formatDecimal(split.carbsPercent),
    fatPercent: split === undefined ? "" : formatDecimal(split.fatPercent),
  };
}
