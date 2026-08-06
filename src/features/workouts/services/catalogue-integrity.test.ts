import { describe, expect, it } from "vitest";

import type { CatalogueEntry } from "../validation/exercise-schema";
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
} from "./catalogue-integrity";

/**
 * Fed deliberately broken input.
 *
 * `catalogue.test.ts` runs these same checks over the real catalogue and
 * expects silence — which proves nothing on its own, since a check that never
 * fires is indistinguishable from one that always passes. This file is what
 * makes that silence mean something.
 */

const entry = (overrides: Partial<CatalogueEntry> & { id: string }): CatalogueEntry =>
  ({
    name: `Exercício ${overrides.id}`,
    primaryMuscles: ["chest"],
    equipment: ["barbell"],
    ...overrides,
  }) as CatalogueEntry;

describe("findDuplicates", () => {
  it("is silent on distinct values", () => {
    expect(findDuplicates(["a", "b", "c"])).toEqual([]);
  });

  it("catches a repeat", () => {
    expect(findDuplicates(["a", "b", "a"])).toEqual(["a"]);
  });

  it("reports a value once however often it repeats", () => {
    expect(findDuplicates(["a", "a", "a"])).toEqual(["a"]);
  });
});

describe("normalizeName", () => {
  it("makes accents and case irrelevant", () => {
    expect(normalizeName("Agachamento Búlgaro")).toBe(
      normalizeName("  agachamento bulgaro  "),
    );
  });
});

describe("findMisplaced", () => {
  it("is silent when the first primary muscle matches the file", () => {
    expect(findMisplaced([entry({ id: "supino" })], "peito")).toEqual([]);
  });

  it("catches a chest exercise filed under costas", () => {
    const found = findMisplaced([entry({ id: "supino" })], "costas");

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("peito.json");
  });

  it("places by the first primary muscle, since order means dominance", () => {
    // Pullover is lats first, chest second — it belongs with backs.
    const pullover = entry({ id: "pullover", primaryMuscles: ["lats", "chest"] });

    expect(findMisplaced([pullover], "costas")).toEqual([]);
    expect(findMisplaced([pullover], "peito")).toHaveLength(1);
  });

  it("leaves cardio alone, since it is placed by pattern", () => {
    const running = entry({
      id: "corrida",
      primaryMuscles: ["quads"],
      movementPattern: "cardio",
    });

    expect(findMisplaced([running], "cardio")).toEqual([]);
  });
});

describe("findStrayCardio", () => {
  it("catches cardio filed under a muscle region", () => {
    const running = entry({
      id: "corrida",
      primaryMuscles: ["quads"],
      movementPattern: "cardio",
    });

    expect(findStrayCardio([running], "pernas")).toHaveLength(1);
    expect(findStrayCardio([running], "cardio")).toEqual([]);
  });
});

describe("aliases", () => {
  it("catches an alias pointing at no exercise", () => {
    const orphans = findOrphanAliases({ "nao-existe": ["X"] }, new Set(["existe"]));

    expect(orphans).toEqual(["nao-existe"]);
  });

  it("catches the same alias claimed by two exercises", () => {
    const clashes = findAmbiguousAliases({
      "supino-barra": ["Supino"],
      "supino-halteres": ["supino"],
    });

    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toContain("supino-barra");
    expect(clashes[0]).toContain("supino-halteres");
  });

  it("treats accents as the same alias", () => {
    const clashes = findAmbiguousAliases({
      a: ["Flexão"],
      b: ["flexao"],
    });

    expect(clashes).toHaveLength(1);
  });

  it("catches an alias that only repeats the exercise's own name", () => {
    const redundant = findRedundantAliases(
      { supino: ["Supino Reto com Barra"] },
      new Map([["supino", normalizeName("Supino Reto com Barra")]]),
    );

    expect(redundant).toHaveLength(1);
  });

  it("is silent on a genuine synonym", () => {
    const redundant = findRedundantAliases(
      { supino: ["Bench Press"] },
      new Map([["supino", normalizeName("Supino Reto com Barra")]]),
    );

    expect(redundant).toEqual([]);
  });
});

describe("findIncoherent", () => {
  it("is silent on a coherent entry", () => {
    expect(
      findIncoherent([
        entry({ id: "ok", isCompound: true, secondaryMuscles: ["triceps"] }),
      ]),
    ).toEqual([]);
  });

  it("catches an isolation exercise claiming several primary muscles", () => {
    const found = findIncoherent([
      entry({
        id: "confuso",
        primaryMuscles: ["chest", "triceps"],
        isCompound: false,
      }),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("isolado");
  });

  it("catches an isolation pattern marked compound", () => {
    const found = findIncoherent([
      entry({ id: "confuso", movementPattern: "isolation", isCompound: true }),
    ]);

    expect(found).toHaveLength(1);
  });

  it("catches a muscle listed in two roles at once", () => {
    const found = findIncoherent([
      entry({
        id: "confuso",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps"],
        stabilizerMuscles: ["triceps"],
      }),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("mais de um papel");
  });
});

describe("findVanishedIds", () => {
  it("is silent while every published id is still present", () => {
    expect(findVanishedIds(["a", "b"], new Set(["a", "b", "c"]))).toEqual([]);
  });

  it("catches a published id removed without being retired", () => {
    expect(findVanishedIds(["a", "b"], new Set(["a"]))).toEqual(["b"]);
  });
});
