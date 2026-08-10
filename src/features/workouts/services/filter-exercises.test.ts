import { describe, expect, it } from "vitest";

import type { Exercise } from "../types/exercise";
import {
  countActiveFilters,
  EMPTY_FILTERS,
  filterExercises,
  type ExerciseFilters,
} from "./filter-exercises";

function exercise(overrides: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: `Exercício ${overrides.id}`,
    aliases: [],
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
    ...overrides,
  };
}

const filters = (
  overrides: Partial<ExerciseFilters> = {},
): ExerciseFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

const SUPINO = exercise({
  id: "supino",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps"],
  equipment: ["barbell"],
  movementPattern: "horizontal-push",
  technicalDifficulty: "intermediate",
});

const ROSCA = exercise({
  id: "rosca",
  primaryMuscles: ["biceps"],
  equipment: ["dumbbell"],
  movementPattern: "isolation",
  technicalDifficulty: "beginner",
  isFavorite: true,
});

const AGACHAMENTO = exercise({
  id: "agachamento",
  primaryMuscles: ["quads"],
  secondaryMuscles: ["glutes"],
  stabilizerMuscles: ["abs"],
  equipment: ["barbell"],
  movementPattern: "squat",
  technicalDifficulty: "intermediate",
});

const ALL = [SUPINO, ROSCA, AGACHAMENTO];
const ids = (found: readonly Exercise[]) => found.map((e) => e.id);

describe("countActiveFilters", () => {
  it("is zero for the default state", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("counts each selected value, across dimensions", () => {
    expect(
      countActiveFilters(
        filters({
          muscles: new Set(["chest", "biceps"]),
          equipment: new Set(["barbell"]),
          favoritesOnly: true,
        }),
      ),
    ).toBe(4);
  });
});

describe("filterExercises", () => {
  it("returns everything when nothing is selected", () => {
    expect(filterExercises(ALL, EMPTY_FILTERS)).toHaveLength(3);
  });

  describe("muscles", () => {
    it("matches a primary muscle", () => {
      expect(
        ids(filterExercises(ALL, filters({ muscles: new Set(["quads"]) }))),
      ).toEqual(["agachamento"]);
    });

    it("matches a secondary muscle too", () => {
      // Filtering by triceps should surface the bench press, where triceps are
      // worked even though the entry leads with chest.
      expect(
        ids(filterExercises(ALL, filters({ muscles: new Set(["triceps"]) }))),
      ).toEqual(["supino"]);
    });

    it("ignores stabilisers", () => {
      // Every heavy lift braces the core. Including stabilisers would make the
      // abs filter return most of the catalogue.
      expect(
        filterExercises(ALL, filters({ muscles: new Set(["abs"]) })),
      ).toEqual([]);
    });

    it("ORs values within the dimension", () => {
      expect(
        ids(
          filterExercises(
            ALL,
            filters({ muscles: new Set(["quads", "biceps"]) }),
          ),
        ),
      ).toEqual(["rosca", "agachamento"]);
    });
  });

  describe("across dimensions", () => {
    it("ANDs them", () => {
      const found = filterExercises(
        ALL,
        filters({
          muscles: new Set(["chest", "quads"]),
          equipment: new Set(["barbell"]),
          difficulties: new Set(["intermediate"]),
        }),
      );

      expect(ids(found)).toEqual(["supino", "agachamento"]);
    });

    it("returns nothing when the combination excludes everything", () => {
      expect(
        filterExercises(
          ALL,
          filters({
            muscles: new Set(["biceps"]),
            equipment: new Set(["barbell"]),
          }),
        ),
      ).toEqual([]);
    });
  });

  describe("unclassified exercises", () => {
    const semClassificacao = exercise({ id: "sem-classificacao" });

    it("stays out of the pattern filter rather than being guessed in", () => {
      const found = filterExercises(
        [semClassificacao],
        filters({ patterns: new Set(["squat"]) }),
      );

      expect(found).toEqual([]);
    });

    it("stays out of the difficulty filter as well", () => {
      const found = filterExercises(
        [semClassificacao],
        filters({ difficulties: new Set(["beginner"]) }),
      );

      expect(found).toEqual([]);
    });

    it("still appears when no filter constrains it", () => {
      expect(filterExercises([semClassificacao], EMPTY_FILTERS)).toHaveLength(
        1,
      );
    });
  });

  it("narrows to favourites", () => {
    expect(ids(filterExercises(ALL, filters({ favoritesOnly: true })))).toEqual(
      ["rosca"],
    );
  });

  it("preserves the incoming order", () => {
    const found = filterExercises(
      ALL,
      filters({ equipment: new Set(["barbell"]) }),
    );

    expect(ids(found)).toEqual(["supino", "agachamento"]);
  });
});
