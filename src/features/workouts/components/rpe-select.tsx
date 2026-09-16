"use client";

import { useRef, useState } from "react";

import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";

import { RPE_SCALE, describeRpe, formatRpe } from "../taxonomy/rpe";

interface Props {
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly label: string;
  readonly className?: string;
}

const DIAL_MIN = RPE_SCALE[0]!.value;
const DIAL_MAX = RPE_SCALE.at(-1)!.value;

function fractionForValue(value: number | null): number | null {
  if (value === null) return null;
  return Math.min(1, Math.max(0, (value - DIAL_MIN) / (DIAL_MAX - DIAL_MIN)));
}

/** 0 at the left (`DIAL_MIN`), 180 at the right (`DIAL_MAX`), pointing
 * straight up at the midpoint — the same convention the needle's own
 * `rotate()` transform uses, so a pointer's raw angle and a value's display
 * angle are computed by the same formula run in each direction. */
function angleForFraction(fraction: number): number {
  return (fraction - 0.5) * 180;
}

/** The closest step on the scale to an arbitrary angle — never a value
 * between two real RPE steps, since there is no such thing as RPE 8,2. */
function valueForAngle(angleDeg: number): number {
  const fraction = Math.min(1, Math.max(0, angleDeg / 180 + 0.5));
  const raw = DIAL_MIN + fraction * (DIAL_MAX - DIAL_MIN);

  return RPE_SCALE.reduce((closest, step) =>
    Math.abs(step.value - raw) < Math.abs(closest.value - raw)
      ? step
      : closest,
  ).value;
}

function arcPath(cx: number, cy: number, r: number): string {
  return `M ${String(cx - r)} ${String(cy)} A ${String(r)} ${String(r)} 0 0 1 ${String(cx + r)} ${String(cy)}`;
}

/**
 * RPE read at a glance as a dial, chosen by dragging one.
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
 * **The picker is the same dial, grown up and draggable (second round,
 * 17/09/2026: "quero arrastar a barrinha pra selecionar, não aquela
 * tabela").** The grid of eight buttons is gone — dragging a finger along
 * the arc updates the value live. "Sem RPE" cannot live *on* the arc — the
 * scale has no natural "blank" angle — so it stays a plain button beside
 * it, same as it sat first in the grid it replaced. Keyboard reaches the
 * same picker through `role="slider"` and the arrow keys, one scale step at
 * a time.
 *
 * **Releasing the drag used to close the sheet on its own — third round,
 * same day: "deixe um botão para confirmar o RPE."** A release-to-close
 * gesture does not leave room to see the number land, reconsider, and drag
 * again before the sheet is gone; a live preview that only *some* releases
 * happen to commit is worse than one that always waits for an explicit
 * "Confirmar". Dragging still updates `value` (and everything reading it)
 * live, same as before — only the close moved from the pointer's own
 * `pointerup` to this button.
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
        <RpeDial value={value} cx={28} cy={24} r={18} />
      </button>

      <Dialog
        open={open}
        title={label}
        onClose={() => {
          setOpen(false);
        }}
        placement="sheet-bottom"
      >
        <RpeDialPicker value={value} label={label} onChange={onChange} />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              "flex h-11 flex-1 items-center justify-center rounded-md border text-sm transition-colors duration-150 ease-out",
              value === null
                ? "border-accent bg-accent/10 text-ink"
                : "border-line-strong text-ink-muted hover:border-ink-subtle hover:bg-muted",
            )}
          >
            Sem RPE
          </button>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              setOpen(false);
            }}
          >
            Confirmar
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/** The picker's own geometry — bigger than the trigger's, sized for a
 * thumb rather than a glance. */
const PICKER_CX = 140;
const PICKER_CY = 128;
const PICKER_R = 110;
const PICKER_NEEDLE_LEN = PICKER_R - 16;
const PICKER_PATH = arcPath(PICKER_CX, PICKER_CY, PICKER_R);
const PICKER_ARC_LENGTH = Math.PI * PICKER_R;

function RpeDialPicker({
  value,
  label,
  onChange,
}: {
  readonly value: number | null;
  readonly label: string;
  readonly onChange: (value: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const fraction = fractionForValue(value);
  const angle = fraction === null ? null : angleForFraction(fraction);

  function angleFromPointer(clientX: number, clientY: number): number {
    const svg = svgRef.current;
    if (svg === null) return 0;

    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return 0;

    const viewBox = svg.viewBox.baseVal;
    const x = (clientX - rect.left) * (viewBox.width / rect.width);
    const y = (clientY - rect.top) * (viewBox.height / rect.height);
    const dx = x - PICKER_CX;
    const dy = y - PICKER_CY;

    return Math.min(
      90,
      Math.max(-90, Math.atan2(dx, -dy) * (180 / Math.PI)),
    );
  }

  function pick(clientX: number, clientY: number) {
    onChange(valueForAngle(angleFromPointer(clientX, clientY)));
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 280 150"
      role="slider"
      aria-label={label}
      aria-valuemin={DIAL_MIN}
      aria-valuemax={DIAL_MAX}
      aria-valuenow={value ?? DIAL_MIN}
      aria-valuetext={value === null ? "Sem RPE" : formatRpe(value)}
      tabIndex={0}
      className="mx-auto block w-full max-w-72 touch-none select-none outline-none focus-visible:[&>circle]:stroke-accent"
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        pick(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        pick(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        const index = RPE_SCALE.findIndex((step) => step.value === value);

        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          const next = RPE_SCALE[Math.min(RPE_SCALE.length - 1, index + 1)];
          if (next !== undefined) onChange(next.value);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          const prev = RPE_SCALE[Math.max(0, index - 1)];
          if (prev !== undefined) onChange(prev.value);
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(RPE_SCALE[0]!.value);
        } else if (event.key === "End") {
          event.preventDefault();
          onChange(RPE_SCALE.at(-1)!.value);
        }
      }}
    >
      <path
        d={PICKER_PATH}
        fill="none"
        strokeWidth="14"
        strokeLinecap="round"
        className="stroke-muted"
      />
      {fraction !== null && (
        <path
          d={PICKER_PATH}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={PICKER_ARC_LENGTH}
          strokeDashoffset={PICKER_ARC_LENGTH * (1 - fraction)}
          className="stroke-accent"
        />
      )}
      {/* Marcas de escala — as mesmas oito paradas que a grade de botões
          mostrava, agora como referência visual de onde o dedo vai parar,
          não como oito alvos de toque separados. */}
      {RPE_SCALE.map((step) => {
        const tickAngle = angleForFraction(fractionForValue(step.value)!);
        return (
          <line
            key={step.value}
            x1={PICKER_CX}
            y1={PICKER_CY - PICKER_R + 20}
            x2={PICKER_CX}
            y2={PICKER_CY - PICKER_R + 28}
            strokeWidth="2"
            className="stroke-canvas"
            transform={`rotate(${String(tickAngle)} ${String(PICKER_CX)} ${String(PICKER_CY)})`}
          />
        );
      })}
      {angle !== null && (
        <line
          x1={PICKER_CX}
          y1={PICKER_CY}
          x2={PICKER_CX}
          y2={PICKER_CY - PICKER_NEEDLE_LEN}
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-ink"
          transform={`rotate(${String(angle)} ${String(PICKER_CX)} ${String(PICKER_CY)})`}
        />
      )}
      <circle
        cx={PICKER_CX}
        cy={PICKER_CY}
        r="6"
        strokeWidth="2"
        className="fill-surface stroke-ink transition-colors duration-150 ease-out"
      />
      <text
        x={PICKER_CX}
        y={PICKER_CY - 38}
        textAnchor="middle"
        fontSize="30"
        className="fill-ink font-semibold tabular-nums"
      >
        {value === null ? "—" : formatRpe(value)}
      </text>
      {value !== null && (
        <text
          x={PICKER_CX}
          y={PICKER_CY - 14}
          textAnchor="middle"
          fontSize="12"
          className="fill-ink-subtle"
        >
          {describeRpe(value)}
        </text>
      )}
    </svg>
  );
}

/**
 * The dial's geometry — same arc formula and `stroke-dasharray`/`-offset`
 * technique `TodayEnergy`'s `CalorieRing` already uses (π·r for the arc
 * length of a semicircle), scaled to whatever `cx`/`cy`/`r` the caller
 * needs. `RPE_SCALE` supplies the range: 6 at the left end, 10 at the
 * right, so the fraction below is "how far across the scale", not a ratio
 * against a target — there is no target to fall short of or exceed here,
 * which is why this never reaches for `stroke-warning` the way an
 * over-target ring does.
 */
function RpeDial({
  value,
  cx,
  cy,
  r,
}: {
  readonly value: number | null;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}) {
  const fraction = fractionForValue(value);
  const angle = fraction === null ? null : angleForFraction(fraction);
  const path = arcPath(cx, cy, r);
  const arcLength = Math.PI * r;
  const needleLen = r - 5;

  return (
    <svg viewBox="0 0 56 40" aria-hidden className="h-full w-full">
      <path
        d={path}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-muted"
      />
      {fraction !== null && (
        <path
          d={path}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength * (1 - fraction)}
          className="stroke-accent transition-[stroke-dashoffset] duration-(--duration-micro) ease-out"
        />
      )}
      {angle !== null && (
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - needleLen}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-ink transition-transform duration-(--duration-micro) ease-out"
          transform={`rotate(${String(angle)} ${String(cx)} ${String(cy)})`}
        />
      )}
      <circle cx={cx} cy={cy} r="2.5" className="fill-ink" />
      <text
        x={cx}
        y={cy + 14}
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
