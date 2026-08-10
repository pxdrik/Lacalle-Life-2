import type { Region } from "../../taxonomy/muscles";
import type { CatalogueEntry } from "../../validation/exercise-schema";

import bracos from "./bracos.json";
import cardio from "./cardio.json";
import core from "./core.json";
import costas from "./costas.json";
import ombros from "./ombros.json";
import peito from "./peito.json";
import pernas from "./pernas.json";

/**
 * The curated catalogue, by region.
 *
 * This is the one file that lists the regions. Adding an *exercise* never
 * touches it — that is a line in one of the JSON files. Adding a *region*
 * would, and regions are taxonomy, which is code by design.
 *
 * Typed loosely here and parsed by the schema in the tests: the JSON is the
 * source of truth for shape, and TypeScript's inference over a JSON import
 * would otherwise widen every enum to `string` anyway.
 */
export const CATALOGUE_BY_REGION: Readonly<Record<Region, readonly unknown[]>> =
  {
    peito,
    costas,
    ombros,
    bracos,
    pernas,
    core,
    cardio,
  };

export const CATALOGUE = Object.values(
  CATALOGUE_BY_REGION,
).flat() as readonly CatalogueEntry[];
