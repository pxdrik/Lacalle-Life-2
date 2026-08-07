import { describe, expect, it } from "vitest";

import media from "../data/exercise-media.json";
import { CATALOGUE } from "../data/catalogue/catalogue";
import {
  MEDIA_SOURCES,
  mediaAttribution,
  mediaUrl,
  type ExerciseMedia,
} from "./media-sources";

const entries = Object.entries(media) as [string, ExerciseMedia][];

describe("mediaUrl", () => {
  it("joins the source's base url to the stored path", () => {
    const url = mediaUrl({
      source: "free-exercise-db",
      images: ["Barbell_Bench_Press_-_Medium_Grip/0.jpg"],
    });

    expect(url).toBe(
      "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg",
    );
  });

  it("returns null past the end instead of a url with 'undefined' in it", () => {
    expect(mediaUrl({ source: "free-exercise-db", images: [] })).toBeNull();
    expect(mediaUrl({ source: "free-exercise-db", images: ["a.jpg"] }, 1)).toBeNull();
  });
});

describe("attribution", () => {
  it("carries everything CC-BY-SA asks us to name", () => {
    for (const source of Object.values(MEDIA_SOURCES)) {
      expect(source.author).not.toBe("");
      expect(source.license).not.toBe("");
      expect(source.licenseUrl).toMatch(/^https:\/\//);
      expect(source.sourceUrl).toMatch(/^https:\/\//);
      expect(source.authorUrl).toMatch(/^https:\/\//);
      expect(source.repository).not.toBe("");
    }
  });

  it("resolves for every source the mapping actually uses", () => {
    for (const [, entry] of entries) {
      expect(mediaAttribution(entry).license).toBe("CC BY-SA 4.0");
    }
  });
});

describe("exercise-media.json", () => {
  it("maps only ids that exist in the catalogue", () => {
    const ids = new Set(CATALOGUE.map((exercise) => exercise.id));
    const orphans = entries
      .map(([id]) => id)
      .filter((id) => !ids.has(id));

    // A renamed or removed exercise leaves its picture pointing at nothing.
    // Silently dropping it would be fine; noticing is better, because the
    // mapping is hand-verified and a lost pair is work thrown away.
    expect(orphans).toEqual([]);
  });

  it("declares a known source and at least one image per entry", () => {
    for (const [id, entry] of entries) {
      expect(MEDIA_SOURCES[entry.source], id).toBeDefined();
      expect(entry.images.length, id).toBeGreaterThan(0);
    }
  });

  it("stores relative paths, never absolute urls", () => {
    // The base url belongs to the source record. A path that smuggles in its
    // own host would survive a source migration and quietly keep hotlinking.
    for (const [id, entry] of entries) {
      for (const path of entry.images) {
        expect(path, id).not.toMatch(/^https?:\/\//);
        expect(path, id).not.toMatch(/^\//);
      }
    }
  });

  it("does not give two exercises the same illustration", () => {
    // Distinct movements sharing a picture means a match was made by
    // resemblance rather than by identity — exactly the failure mode the
    // hand-verification exists to prevent.
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
