import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS } from "./filter-exercises";
import {
  EMPTY_QUERY,
  parseExerciseQuery,
  serializeExerciseQuery,
  type ExerciseQuery,
} from "./filter-url";

const parse = (search: string) => parseExerciseQuery(new URLSearchParams(search));

describe("serializeExerciseQuery", () => {
  it("produces an empty string for an unfiltered view", () => {
    // An unfiltered page should have a clean URL, not a trail of empty params.
    expect(serializeExerciseQuery(EMPTY_QUERY)).toBe("");
  });

  it("omits a blank search term", () => {
    expect(serializeExerciseQuery({ ...EMPTY_QUERY, text: "   " })).toBe("");
  });

  it("writes each active dimension", () => {
    const search = serializeExerciseQuery({
      text: "supino",
      filters: {
        ...EMPTY_FILTERS,
        muscles: new Set(["chest"]),
        equipment: new Set(["barbell"]),
        favoritesOnly: true,
      },
    });

    expect(search).toContain("q=supino");
    expect(search).toContain("m=chest");
    expect(search).toContain("e=barbell");
    expect(search).toContain("fav=1");
  });

  it("orders values by taxonomy, not by the order they were tapped", () => {
    // Two identical views must produce the same link, or the same filtered
    // page would be shareable under several different URLs.
    const a = serializeExerciseQuery({
      ...EMPTY_QUERY,
      filters: { ...EMPTY_FILTERS, muscles: new Set(["triceps", "chest"]) },
    });
    const b = serializeExerciseQuery({
      ...EMPTY_QUERY,
      filters: { ...EMPTY_FILTERS, muscles: new Set(["chest", "triceps"]) },
    });

    expect(a).toBe(b);
    expect(a).toContain("m=chest,triceps");
  });
});

describe("parseExerciseQuery", () => {
  it("reads an empty URL as the default state", () => {
    expect(parse("")).toEqual(EMPTY_QUERY);
  });

  it("reads every dimension back", () => {
    const query = parse("q=rosca&m=biceps,triceps&e=dumbbell&p=isolation&d=beginner&fav=1");

    expect(query.text).toBe("rosca");
    expect([...query.filters.muscles]).toEqual(["biceps", "triceps"]);
    expect([...query.filters.equipment]).toEqual(["dumbbell"]);
    expect([...query.filters.patterns]).toEqual(["isolation"]);
    expect([...query.filters.difficulties]).toEqual(["beginner"]);
    expect(query.filters.favoritesOnly).toBe(true);
  });

  describe("hostile input", () => {
    // A URL is user-editable. A typo in it must narrow the view, never blank
    // the screen.
    it("drops an unknown value and keeps the valid ones", () => {
      expect([...parse("m=chest,nao-existe,triceps").filters.muscles]).toEqual([
        "chest",
        "triceps",
      ]);
    });

    it("treats an entirely unknown dimension as unset", () => {
      expect(parse("e=laser").filters.equipment.size).toBe(0);
    });

    it("ignores an empty parameter", () => {
      expect(parse("m=&e=").filters.muscles.size).toBe(0);
    });

    it("reads anything but 1 as favourites off", () => {
      expect(parse("fav=sim").filters.favoritesOnly).toBe(false);
      expect(parse("fav=0").filters.favoritesOnly).toBe(false);
    });
  });
});

describe("round trip", () => {
  it("survives serialise then parse", () => {
    const original: ExerciseQuery = {
      text: "rosca direta",
      filters: {
        muscles: new Set(["biceps"]),
        equipment: new Set(["barbell", "dumbbell"]),
        patterns: new Set(["isolation"]),
        difficulties: new Set(["beginner", "intermediate"]),
        favoritesOnly: true,
      },
    };

    // This is what makes a refresh restore the view: whatever was written has
    // to read back identical.
    expect(parse(serializeExerciseQuery(original))).toEqual(original);
  });

  it("survives an unfiltered round trip", () => {
    expect(parse(serializeExerciseQuery(EMPTY_QUERY))).toEqual(EMPTY_QUERY);
  });
});
