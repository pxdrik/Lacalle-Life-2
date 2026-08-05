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
