/**
 * Where exercise photographs come from, and under what terms.
 *
 * The licence is data, not a comment, because CC-BY-SA obliges us to credit
 * the author wherever the image appears. An attribution someone has to
 * remember to write is an attribution that eventually goes missing; this way
 * the credit is rendered from the same record that produces the URL.
 *
 * **The upstream repository declares the Unlicense, and that is not the whole
 * story.** Its images come from Everkinetic, which publishes them under
 * CC-BY-SA-4.0, and a repository cannot relicense someone else's work into the
 * public domain. Two people asked about this on the issue tracker and neither
 * was answered. We therefore treat the images as what they actually are —
 * CC-BY-SA-4.0, attributed to Everkinetic — which permits commercial use and
 * costs us a credit line.
 *
 * Gym visual's animated GIFs, which are the best material available, are
 * deliberately absent: their terms require buying a licence directly, and no
 * amount of it being redistributed elsewhere changes that.
 */
export const MEDIA_SOURCES = {
  "free-exercise-db": {
    /** jsDelivr fronts the GitHub repo, so nothing is bundled or re-hosted. */
    baseUrl: "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises",
    author: "Everkinetic",
    authorUrl: "https://everkinetic.com",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    repository: "free-exercise-db",
    sourceUrl: "https://github.com/yuhonas/free-exercise-db",
  },
} as const;

export type MediaSource = keyof typeof MEDIA_SOURCES;

export interface ExerciseMedia {
  readonly source: MediaSource;
  /** Paths relative to the source's `baseUrl`. */
  readonly images: readonly string[];
}

export function mediaUrl(media: ExerciseMedia, index = 0): string | null {
  const path = media.images[index];
  if (path === undefined) return null;

  return `${MEDIA_SOURCES[media.source].baseUrl}/${path}`;
}

export function mediaAttribution(media: ExerciseMedia) {
  return MEDIA_SOURCES[media.source];
}
