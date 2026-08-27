"use client";

import { useState } from "react";

import { parseDecimal } from "@/core/format/decimal";

interface Props {
  readonly value: number | null;
  readonly label: string;
  readonly onChange: (value: number | null) => void;
  readonly className?: string | undefined;
}

/**
 * A weight you can actually type.
 *
 * The obvious version — `value={String(set.weightKg)}` with `parseDecimal` on
 * change — loses the separator the instant it is typed: "62," parses to 62,
 * re-renders as "62", and the next keystroke lands on the wrong side of the
 * decimal. On a phone, tapping 6, 2, comma, 5 produced **625 kg**.
 *
 * So the text being typed is held apart from the number it means. The parent
 * still receives every keystroke as a number, because the workout screen saves
 * as you go and there is no submit to wait for.
 */
export function WeightField({ value, label, onChange, className }: Props) {
  const [draft, setDraft] = useState(() => text(value));
  const [seen, setSeen] = useState(value);

  /**
   * Adjusting state during render — React's documented alternative to an
   * effect, and the reason this needs no `useEffect` for the compiler to
   * reject.
   *
   * The guard on `parseDecimal(draft)` is what lets a comma survive: after
   * typing "62,7" the value arrives back as 62.7, which the draft already
   * means, so the text is left exactly as typed. A stepper moving the weight
   * to something the draft does not mean replaces it.
   */
  if (seen !== value) {
    setSeen(value);
    if (parseDecimal(draft) !== value) setDraft(text(value));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      aria-label={label}
      placeholder="—"
      onChange={(event) => {
        const next = readWeight(event.target.value);
        setDraft(next.text);
        onChange(next.weightKg);
      }}
      className={className}
    />
  );
}

/**
 * What may be typed into a set's weight: digits and one separator, nothing
 * else — no minus sign.
 *
 * Found by an external audit (27/08/2026): this field passed `event.target
 * .value` straight to `parseDecimal`, which happily parses "-20" as −20.
 * That −20 then persisted as a real set, silently *subtracting* from the
 * Volume total in Evolução instead of erroring anywhere. The portion field
 * in the diary (`meal-item-row.tsx`'s `readGrams`) already solved exactly
 * this for grams — same technique here, kept as its own function because
 * the two fields disagree on what an empty result means: a portion defaults
 * to `0`, a set's weight stays `null` ("not entered"), same as before this
 * fix.
 */
function readWeight(input: string): {
  readonly text: string;
  readonly weightKg: number | null;
} {
  const kept = input.replace(/[^\d,.]/g, "");
  const [whole = "", ...rest] = kept.split(/[.,]/);
  const text = rest.length === 0 ? whole : `${whole},${rest.join("")}`;

  return { text, weightKg: parseDecimal(text) };
}

/**
 * A comma, like everywhere else in the app — but written by hand rather than
 * with `formatDecimal`, which also groups thousands. "1.000" would come back
 * through `parseDecimal` as 1.
 */
function text(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}
