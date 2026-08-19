"use client";

import { useState } from "react";

import { cn } from "@/design-system/cn";

interface Props {
  /** "HH:mm", 24-hour, or `null` for "no time set". */
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly label: string;
  readonly className?: string;
}

/**
 * A 24-hour HH:mm field, typed and drawn by hand rather than
 * `<input type="time">`.
 *
 * The native field's `value` is always 24-hour per spec — parsing it was
 * never the problem — but Chrome renders its own picker in the OS locale,
 * not the page's. `lang="pt-BR"` on `<html>` does not change that; the
 * picker follows Windows' region setting. On an English-language Windows
 * install that means a meal reads "08:00 AM" in the editor and "08:00" on
 * Hoje one screen over — the same hour, two formats, contradicting the
 * briefing's explicit 24-hour requirement (auditoria externa, 19/08,
 * BUG-003). Same trick as `GramsField` and `WeightField`: hold the format
 * in a component this app controls instead of a browser widget it does not.
 */
export function TimeField({ value, onChange, label, className }: Props) {
  const [draft, setDraft] = useState(() => value ?? "");
  const [seen, setSeen] = useState(value);

  // A change from elsewhere (clearing the field, loading a different meal)
  // replaces the draft; typing that already matches the committed value —
  // "12," is not "12" — is left alone. Same technique `GramsField` uses.
  if (seen !== value) {
    setSeen(value);
    setDraft(value ?? "");
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="--:--"
      value={draft}
      aria-label={label}
      onChange={(event) => {
        const next = mask(event.target.value);
        setDraft(next);
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(next)) onChange(next);
      }}
      onBlur={() => {
        const clamped = clamp(draft);
        setDraft(clamped ?? "");
        onChange(clamped);
      }}
      className={cn("w-16 tabular-nums", className)}
    />
  );
}

/** Digits typed so far, with the colon inserted after the hour. */
function mask(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * Whatever was left in the field, forced into a valid HH:mm or `null`.
 *
 * Runs on blur so a half-typed "9" becomes "09:00" rather than staying
 * invalid text — the same reasoning `GramsField` clamps on, applied to a
 * field where "leave it exactly as typed" has no good partial state to
 * preserve the way a decimal separator does.
 */
function clamp(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // One or two digits typed means only the hour was reached — "9" is
  // "09:00", not "90:00" padded out to a plausible-looking hour.
  const [hourDigits, minuteDigits] =
    digits.length <= 2
      ? [digits, "00"]
      : [digits.slice(0, 2), digits.slice(2).padEnd(2, "0")];

  const hours = Math.min(23, Number(hourDigits));
  const minutes = Math.min(59, Number(minuteDigits));

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
