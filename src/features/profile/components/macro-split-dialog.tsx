"use client";

import { useState } from "react";

import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { MACRO_SPLIT_PRESETS, type MacroSplit } from "@/core/nutrition";
import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { MACRO_CODING, type MacroKey } from "@/design-system/macros";

import { MacroDonut } from "./macro-donut";

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
 * **A small donut per row, not the plain-numbers-only picker this screen
 * started as.** Pedro's first ask was answered with rows of text — the same
 * reasoning that pulled a colour bar back out of the meal card ("mostra os
 * números mesmo, não esse graficozinho"). His follow-up (25/09/2026) asked
 * for the chart here specifically: "aplique os gráficos na aba de Ajustar
 * Distribuição de Macros." The numbers stay — `splitDetail` still prints
 * every percentage — the donut is next to them, not instead of them.
 * `MacroDonut`'s `size`/`showLabels` exist for exactly this: 28 px, no
 * in-chart percentage text, next to a row; a slightly larger live one while
 * "Personalizado" is open, since that is the one split nobody has committed
 * to yet. "Automático" carries no donut — its actual split depends on the
 * profile's weight and goal, not a fixed number this dialog has on hand.
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
            donut={sharesFromSplit(preset)}
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
            {draftComplete && (
              <div className="flex justify-center">
                <MacroDonut
                  size={56}
                  shares={{
                    proteinG: draftValues.proteinPercent!,
                    carbsG: draftValues.carbsPercent!,
                    fatG: draftValues.fatPercent!,
                  }}
                />
              </div>
            )}

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
  donut,
  selected,
  onClick,
}: {
  readonly label: string;
  readonly detail: string | undefined;
  readonly donut?: Record<MacroKey, number>;
  readonly selected: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors duration-150 ease-out",
        selected
          ? "border-accent bg-accent/10"
          : "border-line-strong hover:border-ink-subtle hover:bg-muted",
      )}
    >
      {donut !== undefined && (
        <MacroDonut shares={donut} size={28} showLabels={false} />
      )}
      <span className="flex min-w-0 flex-col items-start">
        <span className="text-sm font-medium text-ink">{label}</span>
        {detail !== undefined && (
          <span className="mt-0.5 text-xs text-ink-subtle">{detail}</span>
        )}
      </span>
    </button>
  );
}

function splitDetail(split: MacroSplit): string {
  return MACRO_CODING.map(
    (macro) => `${macro.short} ${formatDecimal(split[PERCENT_FIELD[macro.key]])}%`,
  ).join(" · ");
}

function sharesFromSplit(split: MacroSplit): Record<MacroKey, number> {
  return {
    proteinG: split.proteinPercent,
    carbsG: split.carbsPercent,
    fatG: split.fatPercent,
  };
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
