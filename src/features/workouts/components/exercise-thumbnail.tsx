"use client";

import { Dumbbell } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/design-system/cn";

import { mediaUrl } from "../taxonomy/media-sources";
import type { Exercise } from "../types/exercise";

/**
 * Matches the source photographs' 3:2 shape, so nothing is cropped.
 *
 * `THUMBNAIL_BOX` is exported so the loading skeleton reserves exactly this
 * space: a placeholder of a different size is a layout shift with extra steps.
 * The numbers below are the same measurements in pixels, which `next/image`
 * needs as intrinsic dimensions to build its srcset.
 */
export const THUMBNAIL_BOX = "h-11 w-16";
const WIDTH = 64;
const HEIGHT = 44;

interface Props {
  readonly exercise: Exercise;
}

/**
 * The exercise's photo, or a placeholder of identical size.
 *
 * The placeholder is not a fallback nobody wanted — most of the catalogue has
 * no image, and rows whose left edge jumps around are harder to scan than rows
 * with a quiet empty tile. It also stands in when the CDN is unreachable,
 * which offline is the normal case rather than an error.
 *
 * It uses the app's own muted surface rather than a fixed colour: the source
 * material is photographs, mostly of dim gyms, so a light tile would leave a
 * bright hole in every unmatched row in dark mode.
 */
export function ExerciseThumbnail({ exercise }: Props) {
  const [failed, setFailed] = useState(false);
  // Truthiness rather than `=== null`: an exercise stored before this field
  // existed has no `media` key, and the type cannot vouch for old rows.
  const url = exercise.media ? mediaUrl(exercise.media) : null;

  return (
    <div
      className={cn(
        THUMBNAIL_BOX,
        "shrink-0 overflow-hidden rounded-md border border-line bg-muted",
      )}
    >
      {url !== null && !failed ? (
        <Image
          src={url}
          alt=""
          width={WIDTH}
          height={HEIGHT}
          loading="lazy"
          onError={() => {
            setFailed(true);
          }}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Dumbbell aria-hidden className="size-4 text-ink-subtle" />
        </div>
      )}
    </div>
  );
}
