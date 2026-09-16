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
 * RPE read at a glance as a dial, chosen from a bottom sheet of buttons.
 *
 * **The dial (17/09/2026, Pedro: "um meio círculo e um ponteiro").** The
 * trigger used to just print the number in a bordered box — plain, but also
 * the one field in the row that reads as "an amount" rather than "an amount
 * against a target", the way reps and weight both do with the planned value
 * printed underneath. A semicircle already exists in this app for exactly
 * this shape of information (`TodayEnergy`'s `CalorieRing`, same instrument
 * framing the brandbook prefers over a full ring), reused here with a needle
 * added: the needle is the read Pedro asked for, the number stays printed
 * under the arc because a value with no digits anywhere in the row is the
 * same complaint he had about the diet card's macro bar hiding numbers
 * behind a shape.
 *
 * **The picker did not change.** A native select was replaced with this grid
 * of buttons for a real reason — eight options each needing a sentence of
 * explanation, which a grid shows all of at once and a `<select>` popup
 * cannot — and that reason has not gone away. The dial only changes what the
 * *closed* trigger looks like; opening it still lands on the same tested
 * grid, one tap answers and closes, "Sem RPE" first.
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
          "flex flex-col items-center justify-center rounded-md border border-line-strong bg-surface transition-colors duration-150 ease-out",
          "hover:border-ink-subtle focus:border-accent",
          className,
        )}
      >
        <RpeDial value={value} />
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

/**
 * The dial's geometry — same arc formula and `stroke-dasharray`/`-offset`
 * technique `TodayEnergy`'s `CalorieRing` already uses (π·r for the arc
 * length of a semicircle), scaled down to fit a set row instead of a home
 * screen hero. `RPE_SCALE` supplies the range: 6 at the left end, 10 at the
 * right, so the fraction below is "how far across the scale", not a ratio
 * against a target — there is no target to fall short of or exceed here,
 * which is why this never reaches for `stroke-warning` the way an
 * over-target ring does.
 */
const DIAL_MIN = RPE_SCALE[0]!.value;
const DIAL_MAX = RPE_SCALE.at(-1)!.value;
const DIAL_CX = 28;
const DIAL_CY = 24;
const DIAL_R = 18;
const DIAL_ARC_LENGTH = Math.PI * DIAL_R;
const DIAL_PATH = `M ${String(DIAL_CX - DIAL_R)} ${String(DIAL_CY)} A ${String(DIAL_R)} ${String(DIAL_R)} 0 0 1 ${String(DIAL_CX + DIAL_R)} ${String(DIAL_CY)}`;
const DIAL_NEEDLE_LEN = DIAL_R - 5;

function RpeDial({ value }: { readonly value: number | null }) {
  const fraction =
    value === null
      ? null
      : Math.min(1, Math.max(0, (value - DIAL_MIN) / (DIAL_MAX - DIAL_MIN)));
  // 0 at the left (DIAL_MIN), 180 at the right (DIAL_MAX), pointing straight
  // up at the midpoint — see the file comment on `CalorieRing` for why a
  // semicircle reads as "instrument", the same reason a needle rotating
  // through it reads as one too.
  const angle = fraction === null ? null : (fraction - 0.5) * 180;

  return (
    <svg viewBox="0 0 56 40" aria-hidden className="h-full w-full">
      <path
        d={DIAL_PATH}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-muted"
      />
      {fraction !== null && (
        <path
          d={DIAL_PATH}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={DIAL_ARC_LENGTH}
          strokeDashoffset={DIAL_ARC_LENGTH * (1 - fraction)}
          className="stroke-accent transition-[stroke-dashoffset] duration-(--duration-micro) ease-out"
        />
      )}
      {angle !== null && (
        <line
          x1={DIAL_CX}
          y1={DIAL_CY}
          x2={DIAL_CX}
          y2={DIAL_CY - DIAL_NEEDLE_LEN}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-ink transition-transform duration-(--duration-micro) ease-out"
          transform={`rotate(${String(angle)} ${String(DIAL_CX)} ${String(DIAL_CY)})`}
        />
      )}
      <circle cx={DIAL_CX} cy={DIAL_CY} r="2.5" className="fill-ink" />
      <text
        x={DIAL_CX}
        y={DIAL_CY + 14}
        textAnchor="middle"
        fontSize="12"
        className={cn(
          "font-semibold tabular-nums",
          value === null ? "fill-ink-subtle" : "fill-ink",
        )}
      >
        {value === null ? "—" : formatRpe(value)}
      </text>
    </svg>
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

