/**
 * Reads a number the way someone in Brazil types it.
 *
 * A pt-BR phone keyboard puts a comma on the decimal key, so "3,6" is what
 * a person will actually enter for 3.6 grams. `Number("3,6")` is `NaN`, which
 * would reject a perfectly correct entry.
 *
 * Returns `null` for anything that is not a single valid number, so callers
 * distinguish "not filled in yet" from a real zero.
 */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const value = Number(trimmed.replace(",", "."));

  return Number.isFinite(value) ? value : null;
}

/**
 * Writes a number the way it is read in Brazil.
 *
 * The mirror of `parseDecimal`, and the half that was missing: the app already
 * accepted "3,6" and then printed it back as "3.6". Worse, it did both at
 * once — the body log wrote 84,2 while the diet beside it wrote 2.7/180, so
 * the same screen used two conventions for the same kind of number.
 *
 * By default this only changes separators, never digits: whatever precision is
 * stored is what appears. `fractionDigits` is for the few places that want a
 * fixed width — a projected weekly change reads better as 0,61 than 0,6.
 *
 * Non-finite input becomes an em dash rather than "NaN". Corrupt data is the
 * display layer's job to contain; nobody should have to decode a stack of
 * letters where a weight belongs.
 */
export function formatDecimal(value: number, fractionDigits?: number): string {
  if (!Number.isFinite(value)) return "—";

  return value.toLocaleString(
    "pt-BR",
    fractionDigits === undefined
      ? undefined
      : {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        },
  );
}
