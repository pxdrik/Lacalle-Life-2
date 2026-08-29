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

const FIELD =
  "h-11 w-full rounded-md border bg-surface px-2 text-center text-base tabular-nums transition-colors duration-150 ease-out";

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
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-center text-sm tabular-nums text-ink-subtle">
          {number}
        </span>

        {/* What was planned, sitting under the field it refers to — a target you
          have to remember is a target you ignore. */}
        {isCardio ? (
          <div className="flex-[2]">
            <DurationField
              value={set.durationSeconds}
              label={`Duração da série ${String(number)} de ${exerciseName}, em minutos`}
              onChange={(durationSeconds) => {
                onChange({ durationSeconds });
              }}
              className={cn(
                FIELD,
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
            <div className="flex-1">
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
                  set.isCompleted ? "border-line" : "border-line-strong",
                )}
              />
              <Planned value={set.planned?.reps ?? null} suffix="reps" />
            </div>

            <div className="flex-1">
              <WeightField
                value={set.weightKg}
                label={`Peso da série ${String(number)} de ${exerciseName}`}
                onChange={(weightKg) => {
                  onChange({ weightKg });
                }}
                className={cn(
                  FIELD,
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
          <div className="w-16 shrink-0">
            <RpeSelect
              value={set.rpe}
              label={`RPE da série ${String(number)} de ${exerciseName}`}
              onChange={(rpe) => {
                onChange({ rpe });
              }}
              className="h-11 w-full"
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

      {/* Only on the set being done, which is the only one anyone is touching.
          Putting a stepper on all eight would double the controls on screen to
          serve one row — and this row is already the highlighted, scrolled-to
          one, so the buttons arrive exactly where the thumb already is. */}
      {/* Cardio has no stepper: a duration is typed, not nudged by a fixed
          rep or plate increment — there is no equivalent "usual" step. */}
      {isNext && !set.isCompleted && !isCardio && (
        <div className="mt-1.5 flex items-center gap-1.5 pl-8">
          <Step
            label={`Menos uma repetição na série ${String(number)} de ${exerciseName}`}
            onClick={() => {
              onChange({
                reps: stepped(set.reps, set.planned?.reps ?? null, -1, 1000),
              });
            }}
          >
            −1
          </Step>
          <Step
            label={`Mais uma repetição na série ${String(number)} de ${exerciseName}`}
            onClick={() => {
              onChange({
                reps: stepped(set.reps, set.planned?.reps ?? null, 1, 1000),
              });
            }}
          >
            +1
          </Step>

          <span aria-hidden className="mx-0.5 text-line-strong">
            ·
          </span>

          <Step
            label={`Menos 2,5 kg na série ${String(number)} de ${exerciseName}`}
            onClick={() => {
              onChange({
                weightKg: stepped(
                  set.weightKg,
                  set.planned?.weightKg ?? null,
                  -PLATE_KG,
                  1000,
                ),
              });
            }}
          >
            −2,5
          </Step>
          <Step
            label={`Mais 2,5 kg na série ${String(number)} de ${exerciseName}`}
            onClick={() => {
              onChange({
                weightKg: stepped(
                  set.weightKg,
                  set.planned?.weightKg ?? null,
                  PLATE_KG,
                  1000,
                ),
              });
            }}
          >
            +2,5
          </Step>
        </div>
      )}
    </li>
  );
}

/** A pair of the smallest plates most gyms stock, which is how loads move. */
const PLATE_KG = 2.5;

/**
 * The next value for a field somebody is nudging rather than typing.
 *
 * Starts from what is in the field, then from what was planned, then from
 * zero: pressing +2,5 on an empty field on a machine you always load to 60
 * should land near 60, not at 2,5.
 *
 * Rounded to two decimals because 62.5 - 2.5 + 2.5 is not reliably 62.5 in
 * binary floating point, and a weight that reads 62.50000000000001 in the
 * field is the sort of thing that makes people stop trusting the number.
 */
function stepped(
  current: number | null,
  planned: number | null,
  delta: number,
  max: number,
): number {
  const base = current ?? planned ?? 0;
  return Math.min(Math.max(0, Math.round((base + delta) * 100) / 100), max);
}

function Step({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "h-9 min-w-11 rounded-md border border-line-strong px-2",
        "text-xs tabular-nums text-ink-muted",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out",
        "active:scale-90 hover:border-accent hover:text-ink",
        "sm:h-7 sm:min-w-9",
      )}
    >
      {children}
    </button>
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
