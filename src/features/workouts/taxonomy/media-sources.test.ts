import { describe, expect, it } from "vitest";

import { CATALOGUE } from "../data/catalogue/catalogue";
import media from "../data/exercise-media.json";
import {
  creditsFor,
  MEDIA_SOURCES,
  mediaUrl,
  resolveCredit,
  type ExerciseMedia,
} from "./media-sources";

const entries = Object.entries(media) as [string, ExerciseMedia][];

const anyMedia = (over: Partial<ExerciseMedia> = {}): ExerciseMedia => ({
  source: "free-exercise-db",
  images: ["a/0.jpg"],
  credit: null,
  ...over,
});

describe("mediaUrl", () => {
  it("joins the source's base url to the stored path", () => {
    expect(
      mediaUrl(
        anyMedia({ images: ["Barbell_Bench_Press_-_Medium_Grip/0.jpg"] }),
      ),
    ).toBe(
      "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg",
    );
  });

  it("uses each source's own base url", () => {
    expect(
      mediaUrl({
        source: "wger",
        images: ["exercise-images/1/a.png"],
        credit: null,
      }),
    ).toBe("https://wger.de/media/exercise-images/1/a.png");
  });

  it("returns null past the end instead of a url with 'undefined' in it", () => {
    expect(mediaUrl(anyMedia({ images: [] }))).toBeNull();
    expect(mediaUrl(anyMedia(), 1)).toBeNull();
  });
});

describe("resolveCredit", () => {
  it("falls back to the source when the photo names no author", () => {
    expect(resolveCredit(anyMedia())?.author).toBe("Everkinetic");
  });

  it("prefers the photo's own credit, for sources that licence per image", () => {
    const credit = resolveCredit({
      source: "wger",
      images: ["exercise-images/1/a.png"],
      credit: {
        author: "roneydya",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      },
    });

    expect(credit?.author).toBe("roneydya");
    expect(credit?.repository).toBe("wger");
  });

  it("returns null when nothing can be credited", () => {
    // wger has no source-level credit, so a photo without its own would be
    // unattributable — the build script refuses to emit one.
    expect(
      resolveCredit({
        source: "wger",
        images: ["exercise-images/1/a.png"],
        credit: null,
      }),
    ).toBeNull();
  });
});

describe("creditsFor", () => {
  it("lists nothing when no photo is on screen", () => {
    expect(creditsFor([null, null])).toEqual([]);
  });

  it("collapses repeats, so one author is credited once", () => {
    expect(creditsFor([anyMedia(), anyMedia(), null])).toHaveLength(1);
  });

  it("keeps the same author apart under different licences", () => {
    // Everkinetic appears under 4.0 via free-exercise-db and 3.0 via wger, and
    // the two licences are not interchangeable.
    const credits = creditsFor([
      anyMedia(),
      {
        source: "wger",
        images: ["exercise-images/125/Leg-raises-1.png"],
        credit: {
          author: "Everkinetic",
          license: "CC BY-SA 3.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
        },
      },
    ]);

    expect(credits).toHaveLength(2);
    expect(credits.map((c) => c.license).sort()).toEqual([
      "CC BY-SA 3.0",
      "CC BY-SA 4.0",
    ]);
  });
});

describe("exercise-media.json", () => {
  it("maps only ids that exist in the catalogue", () => {
    const ids = new Set(CATALOGUE.map((exercise) => exercise.id));
    expect(entries.map(([id]) => id).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("declares a known source and at least one image per entry", () => {
    for (const [id, entry] of entries) {
      expect(MEDIA_SOURCES[entry.source], id).toBeDefined();
      expect(entry.images.length, id).toBeGreaterThan(0);
    }
  });

  it("can credit every photo it ships", () => {
    // The licences involved are all attribution licences. An entry nobody can
    // be credited for is one we are not allowed to display.
    for (const [id, entry] of entries) {
      expect(resolveCredit(entry), id).not.toBeNull();
    }
  });

  it("stores relative paths, never absolute urls", () => {
    for (const [id, entry] of entries) {
      for (const path of entry.images) {
        expect(path, id).not.toMatch(/^https?:\/\//);
        expect(path, id).not.toMatch(/^\//);
      }
    }
  });

  it("does not give two exercises the same photo", () => {
    // Distinct movements sharing a picture means a match was made by
    // resemblance rather than by identity.
    const seen = new Map<string, string>();

    for (const [id, entry] of entries) {
      const first = entry.images[0];
      if (first === undefined) continue;

      const owner = seen.get(first);
      expect(owner, `${id} reusa a imagem de ${String(owner)}`).toBeUndefined();
      seen.set(first, id);
    }
  });
});
