"use client";

import { cn } from "@/design-system/cn";

import { RPE_SCALE, describeRpe } from "../taxonomy/rpe";

interface Props {
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly label: string;
  readonly className?: string;
}

/**
 * RPE as a native `<select>`.
 *
 * The scale has eight steps with meanings that need explaining, and a native
 * select gets that right on every platform for free: it is keyboard operable,
 * it announces the description with the option, and on a phone it opens the
 * OS picker instead of a custom sheet that has to be built and then debugged.
 *
 * The blank option is first and is the default. RPE is never required, so the
 * field has to make "I did not rate this" as easy as any other answer.
 */
export function RpeSelect({ value, onChange, label, className }: Props) {
  return (
    <select
      value={value === null ? "" : String(value)}
      aria-label={label}
      title={value === null ? "Sem RPE" : (describeRpe(value) ?? undefined)}
      onChange={(event) => {
        onChange(event.target.value === "" ? null : Number(event.target.value));
      }}
      className={cn(
        "rounded-md border border-line bg-surface px-1.5 py-1 text-center text-sm tabular-nums",
        "transition-colors duration-150 ease-out hover:border-line-strong",
        value === null && "text-ink-subtle",
        className,
      )}
    >
      <option value="">—</option>
      {RPE_SCALE.map((step) => (
        <option key={step.value} value={step.value}>
          {step.label} · {step.description}
        </option>
      ))}
    </select>
  );
}
