"use client";

import { Dumbbell, Pause, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { cn } from "@/design-system/cn";
import { useReducedMotion } from "@/design-system/hooks/use-reduced-motion";

import { mediaUrl } from "../taxonomy/media-sources";
import type { Exercise } from "../types/exercise";

/** How long each position holds. Slow enough to read, fast enough to connect. */
const PHASE_MS = 1100;

const PHASE_LABELS = ["Início", "Fim"] as const;

/**
 * The movement, as the two positions the source actually gives us.
 *
 * Every photographed exercise in the catalogue ships **two** frames — start
 * and end — because that is Everkinetic's convention. Showing only the first
 * was throwing away the half that carries the information: a still of someone
 * lying on a bench says almost nothing, and the pair says "this is the range".
 *
 * Alternating between them is the cheapest honest animation available. Nothing
 * new is downloaded and nothing is invented.
 */
export function ExercisePhotos({ exercise }: { readonly exercise: Exercise }) {
  const reducedMotion = useReducedMotion();
  const [wantsPlaying, setWantsPlaying] = useState(true);
  const [phase, setPhase] = useState(0);

  const media = exercise.media;
  const urls =
    media === null
      ? []
      : media.images
          .map((_, index) => mediaUrl(media, index))
          .filter((url): url is string => url !== null);

  // The OS setting always wins over the toggle, and a single frame has nothing
  // to alternate with.
  const playing = wantsPlaying && !reducedMotion && urls.length > 1;
  const frames = urls.length;

  // A counter advanced by the interval, not a phase derived from the clock.
  // Deriving `Math.floor(now / PHASE_MS) % 2` looks tidier and is wrong here:
  // when `setInterval` drifts past a boundary the parity comes out unchanged
  // and the same frame holds for two beats, which reads as a stutter.
  useEffect(() => {
    if (!playing) return;

    const id = setInterval(() => {
      setPhase((current) => (current + 1) % frames);
    }, PHASE_MS);

    return () => {
      clearInterval(id);
    };
  }, [playing, frames]);

  /**
   * Says so, rather than rendering nothing.
   *
   * 25 of the catalogue's exercises have no photograph, and returning `null`
   * collapsed this column — leaving the detail view with a wide empty area
   * beside the metadata and no explanation. A design audit read that as a
   * broken image. An absent photo is a known, permanent state of the data, so
   * it gets a label instead of a gap.
   */
  if (urls.length === 0) {
    return (
      <div className="flex aspect-3/2 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-muted text-center">
        <Dumbbell aria-hidden className="size-7 text-ink-subtle" />
        <p className="px-4 text-sm text-ink-muted">
          Sem foto para este exercício.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-3/2 w-full overflow-hidden rounded-xl border border-line bg-muted">
        {urls.map((url, index) => (
          <Image
            key={url}
            src={url}
            // Only the visible frame carries a description; the other is
            // stacked underneath and would otherwise be announced twice.
            alt={
              index === phase
                ? `${exercise.name}: posição ${PHASE_LABELS[index] ?? ""}`
                : ""
            }
            aria-hidden={index === phase ? undefined : true}
            fill
            sizes="(min-width: 48rem) 44rem, 100vw"
            priority={index === 0}
            className={cn(
              "object-cover transition-opacity duration-300 ease-out",
              index === phase ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>

      {urls.length > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <div
            className="flex rounded-lg border border-line p-0.5"
            role="group"
            aria-label="Fase do movimento"
          >
            {urls.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-pressed={index === phase}
                onClick={() => {
                  setWantsPlaying(false);
                  setPhase(index);
                }}
                className={cn(
                  "rounded-md px-3 py-1 text-xs transition-colors duration-150 ease-out",
                  index === phase
                    ? "bg-accent text-accent-ink"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {PHASE_LABELS[index] ?? String(index + 1)}
              </button>
            ))}
          </div>

          {!reducedMotion && (
            <button
              type="button"
              onClick={() => {
                setWantsPlaying(!playing);
              }}
              aria-label={playing ? "Pausar animação" : "Animar movimento"}
              className="flex size-8 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
            >
              {playing ? (
                <Pause aria-hidden className="size-3.5" />
              ) : (
                <Play aria-hidden className="size-3.5" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
