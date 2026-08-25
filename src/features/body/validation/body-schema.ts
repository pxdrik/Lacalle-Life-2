import { z } from "zod";

import { INPUT_BOUNDS } from "@/core/nutrition";

import {
  MEASUREMENT_SITES,
  MEASUREMENT_SITE_LABELS,
  type MeasurementSite,
} from "../taxonomy/measurement-sites";

/**
 * Plausibility for a body measurement, and nothing more.
 *
 * `features/body` was the **only feature without a `validation/`**: the form
 * called `parseDecimal` and stored whatever came back. A weight of −15 kg was
 * accepted, became "peso atual", and distorted the trend line and the 30-day
 * delta — on the screen whose entire job is showing whether the number is
 * moving. Body fat and the nine tape measurements had the same hole.
 *
 * **These are floors and ceilings, not opinions.** The schema exists to catch
 * a slipped digit and a stray minus sign, not to tell anyone what their body
 * should measure. Everything inside the range is accepted without comment.
 *
 * Weight and body fat reuse `INPUT_BOUNDS`, which the nutrition engine already
 * applies to the same two quantities. Two ranges for one measurement is how
 * the app would come to disagree with itself about what a plausible weight is.
 */
/**
 * Exported so `composition/backup-schemas.ts` can validate an imported
 * measurement against the same range this form does, rather than re-stating
 * `10`/`300` as a second, driftable copy of the same fact.
 */
export const MEASUREMENT_BOUNDS = { min: 10, max: 300 } as const;

/**
 * Every field is optional — blank means "not measured", which the model
 * carries as `null` and the charts skip. Only a value that *is* there gets
 * checked.
 *
 * One message per field rather than one per bound: "entre 30 e 300 kg" tells
 * someone who typed 3 what to do, and "não pode ser menor que 30" makes them
 * guess the other end.
 */
function bounded(
  label: string,
  unit: string,
  { min, max }: { readonly min: number; readonly max: number },
) {
  const message = `${label} fica entre ${String(min)} e ${String(max)} ${unit}.`;

  return z.number().min(min, message).max(max, message).nullable();
}

/**
 * Built from `MEASUREMENT_SITES` rather than written out, so a site added to
 * the taxonomy is validated the same day it appears in the form — the same
 * property the labels and the chart already have.
 */
const measurementsSchema = z.object(
  Object.fromEntries(
    MEASUREMENT_SITES.map((site) => [
      site,
      bounded(MEASUREMENT_SITE_LABELS[site], "cm", MEASUREMENT_BOUNDS),
    ]),
  ) as Record<MeasurementSite, ReturnType<typeof bounded>>,
);

/**
 * What the form fills in.
 *
 * The day is deliberately absent: it is already constrained by the date
 * input's `max` and by the future check the form does out loud, and both of
 * those say more than a schema could. `notes` is free text and stays free.
 */
export const bodyEntrySchema = z.object({
  weightKg: bounded("O peso", "kg", INPUT_BOUNDS.weightKg),
  bodyFatPercent: bounded("A gordura", "%", INPUT_BOUNDS.bodyFatPercent),
  measurements: measurementsSchema,
});

export type BodyEntryInput = z.infer<typeof bodyEntrySchema>;
