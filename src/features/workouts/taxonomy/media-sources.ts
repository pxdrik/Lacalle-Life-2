/**
 * Where exercise photographs come from, and under what terms.
 *
 * The licence is data, not a comment, because every source here is a Creative
 * Commons attribution licence: showing the photo obliges us to name the author.
 * An attribution someone has to remember to write is one that eventually goes
 * missing, so the credit is rendered from the same record that builds the URL.
 *
 * **The two sources differ in where the credit lives, and the model has to
 * carry that.** free-exercise-db is one collection by one author, so the credit
 * belongs to the source. wger accepts uploads from many people under several
 * licences, so the credit belongs to the individual photo.
 *
 * Gym visual's animated GIFs, which are the best material available, are
 * deliberately absent: their terms require buying a licence directly, and no
 * amount of it being redistributed elsewhere changes that.
 */

export interface Credit {
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string;
}

interface Source {
  readonly baseUrl: string;
  readonly repository: string;
  readonly sourceUrl: string;
  /** Covers every image, for a collection licensed as a whole. */
  readonly credit: Credit | null;
}

export const MEDIA_SOURCES = {
  "free-exercise-db": {
    /** jsDelivr fronts the GitHub repo, so nothing is bundled or re-hosted. */
    baseUrl: "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises",
    repository: "free-exercise-db",
    sourceUrl: "https://github.com/yuhonas/free-exercise-db",
    /**
     * The repository declares the Unlicense and that is not the whole story:
     * the images come from Everkinetic under CC BY-SA 4.0, and nobody
     * relicenses someone else's work into the public domain. Two people asked
     * about it on the issue tracker and neither was answered. We treat the
     * images as what they are, which permits commercial use and costs a line
     * of credit.
     */
    credit: {
      author: "Everkinetic",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  wger: {
    baseUrl: "https://wger.de/media",
    repository: "wger",
    sourceUrl: "https://wger.de",
    /** Null on purpose: wger credits per photo. See `ExerciseMedia.credit`. */
    credit: null,
  },
} as const satisfies Record<string, Source>;

export type MediaSource = keyof typeof MEDIA_SOURCES;

export interface ExerciseMedia {
  readonly source: MediaSource;
  /** Paths relative to the source's `baseUrl`. */
  readonly images: readonly string[];
  /**
   * Credit for this specific photo, for sources that licence per image.
   *
   * `null` means the source's own credit applies. Every entry resolves to
   * exactly one credit — `scripts/build-exercise-media.mjs` refuses to emit an
   * entry that would resolve to none.
   */
  readonly credit: Credit | null;
}

export function mediaUrl(media: ExerciseMedia, index = 0): string | null {
  const path = media.images[index];
  if (path === undefined) return null;

  return `${MEDIA_SOURCES[media.source].baseUrl}/${path}`;
}

export interface ResolvedCredit extends Credit {
  readonly repository: string;
  readonly sourceUrl: string;
}

/** The credit owed for one photo, per-image first, then the source's. */
export function resolveCredit(media: ExerciseMedia): ResolvedCredit | null {
  const source = MEDIA_SOURCES[media.source];
  const credit = media.credit ?? source.credit;
  if (credit === null) return null;

  return { ...credit, repository: source.repository, sourceUrl: source.sourceUrl };
}

/**
 * One entry per distinct credit among the photos actually on screen.
 *
 * Distinct by author *and* licence, because wger hosts the same author under
 * more than one licence, and CC-BY-SA 3.0 and 4.0 are not interchangeable.
 */
export function creditsFor(
  media: readonly (ExerciseMedia | null)[],
): readonly ResolvedCredit[] {
  const seen = new Map<string, ResolvedCredit>();

  for (const entry of media) {
    if (entry === null) continue;

    const credit = resolveCredit(entry);
    if (credit === null) continue;

    seen.set(`${credit.author}|${credit.license}|${credit.repository}`, credit);
  }

  return [...seen.values()].sort((a, b) => a.author.localeCompare(b.author, "pt-BR"));
}
