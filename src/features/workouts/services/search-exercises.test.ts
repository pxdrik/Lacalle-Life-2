import { describe, expect, it } from "vitest";

import type { Exercise } from "../types/exercise";
import { buildExerciseIndex, searchExercises } from "./search-exercises";

function exercise(name: string, aliases: string[] = []): Exercise {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    aliases,
    primaryMuscles: ["chest"],
    secondaryMuscles: [],
    stabilizerMuscles: [],
    equipment: ["barbell"],
    movementPattern: null,
    movementPlanes: [],
    technicalDifficulty: null,
    isUnilateral: null,
    isCompound: null,
    media: null,
    classification: "catalogue",
    isCustom: false,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

const CATALOGUE = [
  exercise("Agachamento Búlgaro", ["Búlgaro", "Bulgarian Split Squat"]),
  exercise("Crucifixo na Máquina", ["Voador", "Peck Deck"]),
  exercise("Rosca 21"),
  exercise("Rosca Direta com Barra", ["Bíceps", "Barbell Curl"]),
  exercise("Supino Reto com Barra", ["Supino", "Bench Press"]),
  exercise("Tríceps na Polia com Corda", ["Corda"]),
];

const index = buildExerciseIndex(CATALOGUE);
const names = (found: readonly Exercise[]) => found.map((e) => e.name);

describe("searchExercises", () => {
  it("returns everything for an empty query", () => {
    expect(searchExercises(index, "")).toHaveLength(CATALOGUE.length);
  });

  it("ignores surrounding whitespace", () => {
    expect(searchExercises(index, "   ")).toHaveLength(CATALOGUE.length);
  });

  describe("accents", () => {
    it("finds an accented name from unaccented input", () => {
      // Nobody reaches for the ú on a phone keyboard mid-workout.
      expect(names(searchExercises(index, "bulgaro"))).toContain(
        "Agachamento Búlgaro",
      );
    });

    it("finds it from accented input too", () => {
      expect(names(searchExercises(index, "búlgaro"))).toContain(
        "Agachamento Búlgaro",
      );
    });

    it("matches an accented alias from unaccented input", () => {
      expect(names(searchExercises(index, "biceps"))).toContain(
        "Rosca Direta com Barra",
      );
    });
  });

  describe("aliases", () => {
    it("finds an exercise by a name it does not have", () => {
      expect(names(searchExercises(index, "voador"))).toEqual([
        "Crucifixo na Máquina",
      ]);
    });

    it("finds it by an English alias", () => {
      expect(names(searchExercises(index, "bench"))).toEqual([
        "Supino Reto com Barra",
      ]);
    });
  });

  describe("ranking", () => {
    it("puts a name prefix first", () => {
      expect(names(searchExercises(index, "rosca"))[0]).toBe("Rosca 21");
    });

    it("ranks the exercise's own name above someone else's alias", () => {
      // "Supino Reto com Barra" starts with the term; nothing else should
      // outrank it just because an alias contains the word.
      expect(names(searchExercises(index, "supino"))[0]).toBe(
        "Supino Reto com Barra",
      );
    });

    it("ranks a whole-name prefix above a mid-name word", () => {
      const found = names(searchExercises(index, "agachamento"));

      expect(found[0]).toBe("Agachamento Búlgaro");
    });
  });

  describe("multiple terms", () => {
    it("matches terms in any order", () => {
      expect(names(searchExercises(index, "barra supino"))).toEqual([
        "Supino Reto com Barra",
      ]);
    });

    it("requires every term to match", () => {
      expect(searchExercises(index, "supino jacaré")).toEqual([]);
    });

    it("lets one term match the name and another an alias", () => {
      expect(names(searchExercises(index, "crucifixo voador"))).toEqual([
        "Crucifixo na Máquina",
      ]);
    });
  });

  it("returns nothing when there is no match", () => {
    expect(searchExercises(index, "zzzz")).toEqual([]);
  });

  it("does not mutate the catalogue", () => {
    const snapshot = [...CATALOGUE];
    searchExercises(index, "rosca");

    expect(CATALOGUE).toEqual(snapshot);
  });
});

describe("scale", () => {
  /**
   * Asserts *shape*, not milliseconds.
   *
   * A wall-clock threshold measures the machine, not the code: these numbers
   * triple when the suite runs its files in parallel, so a bound tight enough
   * to mean something is also tight enough to fail on a busy laptop. A ratio
   * between two sizes cancels machine speed out — doubling the catalogue must
   * roughly double the work, and anything quadratic shows up as ~4x however
   * fast the CPU is.
   *
   * Absolute timings for the audit live in `scripts/benchmark-search.mjs`,
   * where they can be run on a quiet machine and read as measurements rather
   * than as pass/fail.
   */
  const MOVEMENTS = ["Supino", "Remada", "Agachamento", "Rosca", "Elevação"];
  const VARIANTS = ["Reto", "Inclinado", "Curvado", "Unilateral", "Alternado"];
  const TOOLS = ["Barra", "Halteres", "Máquina", "Polia", "Smith"];

  const catalogueOf = (size: number) =>
    Array.from({ length: size }, (_, i) =>
      exercise(
        `${MOVEMENTS[i % 5]!} ${VARIANTS[i % 5]!} ${TOOLS[i % 5]!} ${String(i)}`,
        [`Variação ${String(i)}`],
      ),
    );

  /** Median of several runs, so one unlucky sample cannot decide the result. */
  function medianSearchMs(size: number): number {
    const index = buildExerciseIndex(catalogueOf(size));
    const samples: number[] = [];

    for (let run = 0; run < 7; run += 1) {
      const started = performance.now();
      searchExercises(index, "supino");
      samples.push(performance.now() - started);
    }

    return samples.sort((a, b) => a - b)[3]!;
  }

  it("grows linearly with the catalogue, not quadratically", () => {
    const small = medianSearchMs(20_000);
    const large = medianSearchMs(40_000);

    // Linear would be ~2x. Quadratic would be ~4x. The bar sits between them,
    // wide enough to absorb noise and narrow enough to catch the regression.
    expect(large / Math.max(small, 0.01)).toBeLessThan(3);
  });

  it("returns only what matches, however large the catalogue", () => {
    // Correctness at scale, which no timing assertion covers: a fast search
    // that returns the wrong rows is worse than a slow one.
    const index = buildExerciseIndex(catalogueOf(20_000));
    const found = searchExercises(index, "supino");

    expect(found).toHaveLength(4000);
    expect(found.every((e) => e.name.startsWith("Supino"))).toBe(true);
  });
});
