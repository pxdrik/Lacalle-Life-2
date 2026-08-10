/**
 * Where a tape measure goes.
 *
 * A list in code rather than free-text fields, for the same reason the exercise
 * taxonomy is: a chart of "cintura" over time only works if every entry spells
 * it the same way. Adding a site here adds it to the form, the chart and the
 * history at once.
 *
 * Order is head to toe, because that is the order people measure in.
 */
export const MEASUREMENT_SITES = [
  "neck",
  "chest",
  "arm",
  "forearm",
  "waist",
  "abdomen",
  "hip",
  "thigh",
  "calf",
] as const;

export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];

export const MEASUREMENT_SITE_LABELS: Readonly<
  Record<MeasurementSite, string>
> = {
  neck: "Pescoço",
  chest: "Tórax",
  arm: "Braço",
  forearm: "Antebraço",
  waist: "Cintura",
  abdomen: "Abdômen",
  hip: "Quadril",
  thigh: "Coxa",
  calf: "Panturrilha",
};

/**
 * Waist and abdomen are both here on purpose: they are taken at different
 * places (narrowest point versus navel) and people who track one rarely accept
 * the other as a substitute.
 */
export const MEASUREMENT_SITE_HINTS: Readonly<
  Partial<Record<MeasurementSite, string>>
> = {
  waist: "No ponto mais estreito",
  abdomen: "Na altura do umbigo",
};
