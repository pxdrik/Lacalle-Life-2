"use client";

import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Dialog } from "@/design-system/components/dialog";

import { RPE_SCALE, describeRpe, formatRpe } from "../taxonomy/rpe";

interface Props {
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly label: string;
  readonly className?: string;
}

/**
 * RPE as a bottom sheet of buttons, Hevy-style.
 *
 * A native `<select>` used to do this job — right for a short list, wrong for
 * eight options that each need a sentence of explanation: the OS popup gives
 * one line per row, so the description was only ever reachable by opening the
 * list and reading each option in turn, one-handed, mid-set. A grid of
 * buttons shows every value and its meaning at once, and a tap both answers
 * and closes — no separate "confirm" step for a choice that is already final
 * the moment it is made.
 *
 * The blank option ("Sem RPE") sits first in the grid, same as it sat first
 * in the old select: RPE is never required, so skipping it has to be exactly
 * as easy as any other answer.
 */
export function RpeSelect({ value, onChange, label, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={label}
        title={value === null ? "Sem RPE" : (describeRpe(value) ?? undefined)}
        className={cn(
          "rounded-md border border-line-strong bg-surface text-center text-sm tabular-nums transition-colors duration-150 ease-out",
          "hover:border-ink-subtle focus:border-accent",
          value === null && "text-ink-subtle",
          className,
        )}
      >
        {value === null ? "—" : formatRpe(value)}
      </button>

      <Dialog
        open={open}
        title={label}
        onClose={() => {
          setOpen(false);
        }}
        placement="sheet-bottom"
      >
        <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
          <RpeOption
            label="Sem RPE"
            selected={value === null}
            onSelect={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span className="text-base font-semibold">—</span>
            <span className="text-xs text-ink-subtle">Sem RPE</span>
          </RpeOption>

          {RPE_SCALE.map((step) => (
            <RpeOption
              key={step.value}
              label={`${step.label} — ${step.description}`}
              selected={value === step.value}
              onSelect={() => {
                onChange(step.value);
                setOpen(false);
              }}
            >
              <span className="text-base font-semibold tabular-nums">
                {step.label}
              </span>
              <span className="text-xs text-ink-subtle">{step.description}</span>
            </RpeOption>
          ))}
        </div>
      </Dialog>
    </>
  );
}

function RpeOption({
  label,
  selected,
  onSelect,
  children,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-label={label}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-md border px-1.5 py-2 text-center",
        "transition-[background-color,border-color,color] duration-150 ease-out",
        selected
          ? "border-accent bg-accent/10 text-ink"
          : "border-line-strong text-ink hover:border-ink-subtle hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

