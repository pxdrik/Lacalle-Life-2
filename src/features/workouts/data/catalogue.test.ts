import { describe, expect, it } from "vitest";

import {
  findAmbiguousAliases,
  findDuplicates,
  findIncoherent,
  findMisplaced,
  findOrphanAliases,
  findRedundantAliases,
  findStrayCardio,
  findVanishedIds,
  normalizeName,
  type AliasTable,
} from "../services/catalogue-integrity";
import { REGIONS, type Region } from "../taxonomy/muscles";
import {
  catalogueEntrySchema,
  type CatalogueEntry,
} from "../validation/exercise-schema";
import aliases from "./aliases.json";
import { CATALOGUE, CATALOGUE_BY_REGION } from "./catalogue/catalogue";
import publishedIds from "./ids.lock.json";

/**
 * The same integrity checks that `catalogue-integrity.test.ts` proves can
 * fail, run here against the real data and expected to be silent.
 */

const parsed = CATALOGUE.map((entry) => ({
  entry: entry as { id?: unknown },
  result: catalogueEntrySchema.safeParse(entry),
}));

const valid = parsed.flatMap(({ result }) =>
  result.success ? [result.data] : [],
);

const regionEntries = (region: Region): CatalogueEntry[] =>
  (CATALOGUE_BY_REGION[region] as unknown[]).flatMap((entry) => {
    const result = catalogueEntrySchema.safeParse(entry);
    return result.success ? [result.data] : [];
  });

describe("schema", () => {
  it("accepts every entry", () => {
    const failures = parsed
      .filter(({ result }) => !result.success)
      .map(
        ({ entry, result }) =>
          `${String(entry.id ?? "<sem id>")}: ${result.error?.message ?? ""}`,
      );

    expect(failures).toEqual([]);
  });
});

describe("identity", () => {
  it("has no duplicate ids", () => {
    expect(findDuplicates(valid.map((e) => e.id))).toEqual([]);
  });

  it("has no duplicate names, compared without accents or case", () => {
    expect(findDuplicates(valid.map((e) => normalizeName(e.name)))).toEqual([]);
  });

  it("has not lost a published id", () => {
    const present = new Set(valid.map((e) => e.id));

    expect(findVanishedIds(publishedIds as string[], present)).toEqual([]);
  });

  it("lists every catalogue id in the lock", () => {
    // Keeps the lock honest in the other direction: an id that ships without
    // being recorded is one nothing is protecting yet.
    const locked = new Set(publishedIds as string[]);
    const unlocked = valid.map((e) => e.id).filter((id) => !locked.has(id));

    expect(unlocked).toEqual([]);
  });
});

describe("file placement", () => {
  it.each(REGIONS)("%s.json holds only its own region", (region) => {
    const entries = regionEntries(region);

    expect([
      ...findMisplaced(entries, region),
      ...findStrayCardio(entries, region),
    ]).toEqual([]);
  });
});

describe("aliases", () => {
  const table = aliases as AliasTable;

  it("only references exercises that exist", () => {
    expect(findOrphanAliases(table, new Set(valid.map((e) => e.id)))).toEqual(
      [],
    );
  });

  it("has no alias claimed by two exercises", () => {
    expect(findAmbiguousAliases(table)).toEqual([]);
  });

  it("has no alias that merely repeats the exercise's own name", () => {
    const names = new Map(valid.map((e) => [e.id, normalizeName(e.name)]));

    expect(findRedundantAliases(table, names)).toEqual([]);
  });
});

describe("classification coherence", () => {
  it("has no contradictory entry", () => {
    expect(findIncoherent(valid)).toEqual([]);
  });
});
