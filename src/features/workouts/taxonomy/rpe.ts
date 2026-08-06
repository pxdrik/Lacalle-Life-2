/**
 * Rate of Perceived Exertion, anchored in reps in reserve.
 *
 * The half-points are the point. "Between 8 and 9" is a real answer that a
 * whole-number scale forces someone to round away, and the descriptions are
 * what make the number mean the same thing twice — RPE without an anchor is
 * just a mood.
 *
 * The scale is the one salvageable piece of domain knowledge from V1's
 * PSESelector, which had it more precisely than V1's own nutrition module did.
 *
 * Always optional. Nobody should have to rate a set to log it.
 */
export const RPE_SCALE = [
  { value: 6, label: "6", description: "Poderia ter feito +4 repetições" },
  { value: 7, label: "7", description: "Poderia ter feito +3 repetições" },
  { value: 7.5, label: "7,5", description: "Talvez +3 repetições" },
  { value: 8, label: "8", description: "Poderia ter feito +2 repetições" },
  { value: 8.5, label: "8,5", description: "Talvez +2 repetições" },
  { value: 9, label: "9", description: "Poderia ter feito +1 repetição" },
  { value: 9.5, label: "9,5", description: "Talvez +1 repetição" },
  { value: 10, label: "10", description: "Não conseguiria mais nenhuma" },
] as const;

export type RpeValue = (typeof RPE_SCALE)[number]["value"];

export const RPE_VALUES: readonly number[] = RPE_SCALE.map((step) => step.value);

export function isRpeValue(value: number): boolean {
  return RPE_VALUES.includes(value);
}

export function describeRpe(value: number): string | null {
  return RPE_SCALE.find((step) => step.value === value)?.description ?? null;
}

export function formatRpe(value: number): string {
  return RPE_SCALE.find((step) => step.value === value)?.label ?? String(value);
}
