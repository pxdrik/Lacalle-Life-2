"use client";

import { useState } from "react";

import { parseDecimal } from "@/core/format/decimal";

interface Props {
  /** Seconds — the unit `durationSeconds` is stored in everywhere else. */
  readonly value: number | null;
  readonly label: string;
  /** Also seconds; the minute display is this field's business alone. */
  readonly onChange: (value: number | null) => void;
  readonly className?: string | undefined;
}

/**
 * A cardio set's duration, typed in minutes and stored in seconds.
 *
 * Minutes because that is how a person actually thinks about a run or a
 * treadmill session — "40 min", not "2400 s" — but the stored unit stays
 * seconds, matching `restSeconds` and every other duration already in this
 * domain. The conversion happens only at the edges of this component.
 *
 * Same draft/`seen` technique as `WeightField`, for the identical reason:
 * naively deriving the text from the stored number loses the comma the
 * instant it is typed.
 */
const MAX_MINUTES = 360;

export function DurationField({ value, label, onChange, className }: Props) {
  const [draft, setDraft] = useState(() => text(value));
  const [seen, setSeen] = useState(value);

  if (seen !== value) {
    setSeen(value);
    if (toSeconds(parseDecimal(draft)) !== value) setDraft(text(value));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      aria-label={label}
      placeholder="—"
      onChange={(event) => {
        const next = readMinutes(event.target.value);
        setDraft(next.text);
        onChange(next.seconds);
      }}
      className={className}
    />
  );
}

/** Same character rule as `WeightField`: digits and one separator, no sign. */
function readMinutes(input: string): {
  readonly text: string;
  readonly seconds: number | null;
} {
  const kept = input.replace(/[^\d,.]/g, "");
  const [whole = "", ...rest] = kept.split(/[.,]/);
  const text = rest.length === 0 ? whole : `${whole},${rest.join("")}`;

  const minutes = parseDecimal(text);
  if (minutes === null) return { text, seconds: null };

  return { text, seconds: toSeconds(Math.min(minutes, MAX_MINUTES)) };
}

function toSeconds(minutes: number | null): number | null {
  return minutes === null ? null : Math.round(minutes * 60);
}

function text(value: number | null): string {
  if (value === null) return "";
  return String(Math.round((value / 60) * 100) / 100).replace(".", ",");
}
