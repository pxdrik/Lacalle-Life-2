/**
 * Structural equality — same keys, same values, arrays compared position by
 * position. `undefined` and a missing key are the same thing here (an
 * optional field a schema fills in later must not read as "changed"), which
 * is why this walks `Object.keys` rather than using `JSON.stringify`: two
 * objects that stringify to different text because one has a key explicitly
 * set to `undefined` are, for every caller of this function, the same value.
 *
 * Extracted from `composition/sync/food-log-merge.ts`, which needed exactly
 * this to tell "the same meal, synced twice" from "an actual edit" — the same
 * question every other synced entity's conflict detection turned out to be
 * asking (achado de auditoria de design, 03/09/2026: um conflito de peso
 * mostrando "80 kg" contra "80 kg" nunca deveria ter chegado à tela).
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord).filter((key) => aRecord[key] !== undefined);
  const bKeys = Object.keys(bRecord).filter((key) => bRecord[key] !== undefined);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every(
    (key) => bRecord[key] !== undefined && deepEqual(aRecord[key], bRecord[key]),
  );
}
