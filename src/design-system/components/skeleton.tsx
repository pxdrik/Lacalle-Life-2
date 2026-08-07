import { cn } from "@/design-system/cn";

/**
 * A block standing in for content that has not arrived.
 *
 * Extracted because seven screens each drew their own grey rectangles, which
 * meant seven of them were **static** — and a motionless grey box does not
 * read as loading, it reads as a layout that failed. The pulse is the whole
 * difference between "wait" and "broken".
 *
 * `aria-hidden` because a skeleton is a placeholder for sighted scanning.
 * Screen readers should hear the loading state announced once, by the region
 * that owns it, not a description of nine grey rectangles.
 *
 * Under `prefers-reduced-motion` the pulse stops: `globals.css` collapses
 * animation to a single instant frame, which leaves a plain block — still
 * legible as a placeholder, and the correct answer for someone who asked the
 * system for less movement.
 */
export function Skeleton({ className }: { readonly className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse-soft rounded-md bg-muted", className)}
    />
  );
}
