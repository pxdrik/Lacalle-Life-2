"use client";

import { cn } from "@/design-system/cn";

import type { Exercise } from "../types/exercise";
import { ExerciseThumbnail } from "./exercise-thumbnail";

interface Props {
  /** The name as the routine or session stored it — never the catalogue's. */
  readonly name: string;
  /**
   * The catalogue entry behind `exerciseId`, when it could be resolved.
   *
   * `undefined` while the catalogue is loading, and permanently if the
   * exercise was deleted. Both are ordinary states: the workout still works,
   * it just cannot show a photo or open a detail.
   */
  readonly catalogue: Exercise | undefined;
  readonly onOpenDetail: (exercise: Exercise) => void;
  /**
   * The line under the name — sets, rest, whatever the screen tracks.
   *
   * `null` renders nothing at all rather than an empty line, so a card with
   * nothing to say there does not reserve space for it.
   */
  readonly children: React.ReactNode;
}

/**
 * The photo-and-name block shared by the routine card and the session card.
 *
 * One component because they are the same thing shown twice, and the brief for
 * this project is explicit that a second implementation of an existing element
 * is a defect rather than a shortcut.
 *
 * **The name comes from the workout, the photo from the catalogue.** That is
 * deliberate and not an inconsistency: `RoutineExercise` copies the name so
 * renaming an exercise never rewrites history, but keeps `exerciseId` live so
 * a corrected photo reaches every routine that already exists.
 */
export function ExerciseIdentity({
  name,
  catalogue,
  onOpenDetail,
  children,
}: Props) {
  const content = (
    <>
      {catalogue !== undefined && <ExerciseThumbnail exercise={catalogue} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{name}</span>
        {children !== null && children !== false && (
          <span className="mt-0.5 block truncate text-xs text-ink-subtle">
            {children}
          </span>
        )}
      </span>
    </>
  );

  const shared = "flex min-w-0 flex-1 items-center gap-3 text-left";

  if (catalogue === undefined) {
    return <span className={shared}>{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        onOpenDetail(catalogue);
      }}
      aria-label={`Ver detalhes de ${name}`}
      className={cn(
        shared,
        "rounded-lg transition-opacity duration-150 ease-out hover:opacity-80",
      )}
    >
      {content}
    </button>
  );
}
