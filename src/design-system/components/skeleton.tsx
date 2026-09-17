import { cn } from "@/design-system/cn";

/**
 * A block standing in for content that has not arrived.
 *
 * Extracted because seven screens each drew their own grey rectangles, which
 * meant seven of them were **static** — and a motionless grey box does not
 * read as loading, it reads as a layout that failed. The shimmer is the
 * whole difference between "wait" and "broken".
 *
 * **Shimmer, not Pulse** — the brandbook names them as two different
 * patterns (a sweeping highlight for loading content, a small breathing
 * mark for background sync) and this used to borrow Pulse's token by
 * mistake. `SyncingOverlay` is the app's one real Pulse; this is the one
 * real Shimmer. See `--animate-shimmer` in `tokens.css`.
 *
 * `aria-hidden` because a skeleton is a placeholder for sighted scanning.
 * Screen readers should hear the loading state announced once, by the region
 * that owns it, not a description of nine grey rectangles.
 *
 * Under `prefers-reduced-motion` the sweep stops: `globals.css` collapses
 * animation to a single instant frame, which leaves a plain block — still
 * legible as a placeholder, and the correct answer for someone who asked the
 * system for less movement.
 */
export function Skeleton({ className }: { readonly className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "skeleton-shimmer animate-shimmer rounded-md bg-muted",
        className,
      )}
    />
  );
}
