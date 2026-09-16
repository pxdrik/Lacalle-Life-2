"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";

import type { PerformedSetChanges } from "../services/edit-session";
import type { PerformedSet } from "../types/session";
import { DurationField } from "./duration-field";
import { RpeSelect } from "./rpe-select";
import { WeightField } from "./weight-field";

interface Props {
  readonly set: PerformedSet;
  readonly index: number;
  readonly exerciseName: string;
  /** The next set to do. Highlighted and scrolled to, never focus-stolen. */
  readonly isNext: boolean;
  /** Whether this exercise is measured by time rather than reps × weight. */
  readonly isCardio: boolean;
  readonly onChange: (changes: PerformedSetChanges) => void;
  readonly onToggleComplete: () => void;
  readonly onRemove: () => void;
}

/**
 * Fixed width, not `w-full` inside a `flex-1` column.
 *
 * **Measured live (17/09/2026): `w-full` here rendered at 21.86px** — under
 * its own left+right padding combined — instead of the ~58px its `flex-1`
 * column actually had available. The field is counter-zoomed against the
 * page's `--ui-scale` (see `tokens.css`, `input, select, textarea { zoom:
 * calc(1 / var(--ui-scale)) }`, kept for the real reason: a field's text has
 * to render at true 16px or iOS Safari zooms the viewport on focus) — and a
 * percentage width resolved against a *flex-grow-computed* parent width,
 * on an element with its own `zoom`, does not resolve correctly. `RpeSelect`
 * never hit this: its wrapper is a plain `w-16`, an **authored** fixed width,
 * not one flex-grow hands it — and percentage-against-fixed resolved fine.
 * That mismatch is also why RPE read as a different size than reps/peso.
 *
 * The fix follows the same working pattern: an authored fixed width instead
 * of a percentage of a computed one. It is also, separately, closer to the
 * reference apps Pedro pointed at (Hevy, MacroFactor) — a set row of a few
 * fixed pills, not fields stretched to fill whatever space is left.
 */
const FIELD =
  "h-11 rounded-md border bg-surface px-2 text-center text-base tabular-nums transition-colors duration-150 ease-out";

export function PerformedSetRow({
  set,
  index,
  exerciseName,
  isNext,
  isCardio,
  onChange,
  onToggleComplete,
  onRemove,
}: Props) {
  const row = useRef<HTMLLIElement>(null);
  const number = index + 1;

  // How many times *this* button has been pressed in this mount. Only used to
  // key the check so the confirmation replays per tap — never read as data.
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    // Scrolled into view, but never focused. Focusing would open the phone
    // keyboard over the rest timer every time a set is marked — the number is
    // usually already right, and typing is the exception.
    if (isNext)
      row.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isNext]);

  return (
    <li
      ref={row}
      className={cn(
        "group rounded-sm border border-transparent px-1 py-1.5",
        "transition-[background-color,border-color] duration-(--duration-micro) ease-out",
        isNext && "bg-muted",
        // Surface and border, not colour and not opacity. `opacity-60` used
        // to be the *only* effect of a finished set — which faded the check
        // button's own accent fill along with everything else, dimming the
        // one signal the row exists to give. A done row now gets the same
        // settled, framed surface a finished `Card` gets elsewhere in the
        // app: `bg-muted` plus a hairline border, permanent rather than a
        // hover state — recognisable mid-workout without a second saturated
        // colour anywhere on the line.
        set.isCompleted && "border-line bg-muted",
      )}
    >
      <div className="flex items-center justify-between gap-px">
        <span className="w-4 shrink-0 text-center text-sm tabular-nums text-ink-subtle">
          {number}
        </span>

        {/* What was planned, sitting under the field it refers to — a target you
          have to remember is a target you ignore. */}
        {isCardio ? (
          <div className="shrink-0">
            <DurationField
              value={set.durationSeconds}
              label={`Duração da série ${String(number)} de ${exerciseName}, em minutos`}
              onChange={(durationSeconds) => {
                onChange({ durationSeconds });
              }}
              className={cn(
                FIELD,
                "w-24",
                set.isCompleted ? "border-line" : "border-line-strong",
              )}
            />
            <Planned
              value={
                set.planned?.durationSeconds === undefined ||
                set.planned.durationSeconds === null
                  ? null
                  : set.planned.durationSeconds / 60
              }
              suffix="min"
            />
          </div>
        ) : (
          <>
            <div className="shrink-0">
              <input
                type="text"
                inputMode="numeric"
                value={set.reps === null ? "" : String(set.reps)}
                aria-label={`Repetições da série ${String(number)} de ${exerciseName}`}
                placeholder="—"
                onChange={(event) => {
                  onChange({ reps: toWholeNumber(event.target.value) });
                }}
                className={cn(
                  FIELD,
                  "w-14",
                  set.isCompleted ? "border-line" : "border-line-strong",
                )}
              />
              <Planned value={set.planned?.reps ?? null} suffix="reps" />
            </div>

            <div className="shrink-0">
              <WeightField
                value={set.weightKg}
                label={`Peso da série ${String(number)} de ${exerciseName}`}
                onChange={(weightKg) => {
                  onChange({ weightKg });
                }}
                className={cn(
                  FIELD,
                  "w-16",
                  set.isCompleted ? "border-line" : "border-line-strong",
                )}
              />
              <Planned value={set.planned?.weightKg ?? null} suffix="kg" />
            </div>
          </>
        )}

        {/* RPE reports effort against a rep/weight target — a treadmill has
            neither, so there is nothing here for it to rate. */}
        {!isCardio && (
          <div className="shrink-0">
            <RpeSelect
              value={set.rpe}
              label={`RPE da série ${String(number)} de ${exerciseName}`}
              onChange={(rpe) => {
                onChange({ rpe });
              }}
              className="h-11 w-14"
            />
            <Planned value={set.planned?.rpe ?? null} suffix="RPE" />
          </div>
        )}

        {/* 44px, the comfortable one-handed target, and the only large button in
          the row — it is the action repeated dozens of times per workout. */}
        <button
          type="button"
          onClick={() => {
            setTaps((count) => count + 1);
            onToggleComplete();
          }}
          aria-pressed={set.isCompleted}
          aria-label={
            set.isCompleted
              ? `Desmarcar série ${String(number)} de ${exerciseName}`
              : `Concluir série ${String(number)} de ${exerciseName}`
          }
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg border",
            "transition-[background-color,border-color,color,scale] duration-150 ease-out",
            // The one bit of tactile feedback in the app, on the one action
            // repeated dozens of times per workout. It has to answer the tap
            // before the state even changes.
            "active:scale-90",
            set.isCompleted
              ? "border-accent bg-accent text-accent-ink"
              : "border-line-strong text-ink-subtle hover:border-accent hover:text-ink",
          )}
        >
          {/* Keyed by the tap counter, not by `isCompleted`: remounting is
              what replays the animation, and keying it off the state would set
              every check on screen off at once when a finished workout is
              reopened. `taps > 0` is the same guarantee said twice — nothing
              animates until this particular button has been pressed.

              `motion-reduce:animate-none` rather than a hook: the global rule
              collapses animation to 0.01ms, which would land the check at its
              0.6 starting scale and leave it there. */}
          <Check
            key={taps}
            aria-hidden
            className={cn(
              "size-5",
              taps > 0 &&
                set.isCompleted &&
                "animate-pop motion-reduce:animate-none",
            )}
          />
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover série ${String(number)} de ${exerciseName}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-danger/10 hover:text-danger sm:size-7 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function Planned({
  value,
  suffix,
}: {
  readonly value: number | null;
  readonly suffix: string;
}) {
  return (
    <p className="mt-1 h-4 text-center text-xs tabular-nums text-ink-subtle">
      {value === null ? "" : `${formatDecimal(value)} ${suffix}`}
    </p>
  );
}

function toWholeNumber(input: string): number | null {
  const digits = input.replace(/\D/g, "");
  if (digits === "") return null;

  return Math.min(Number(digits), 1000);
}
