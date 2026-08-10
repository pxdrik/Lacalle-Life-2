import { cn } from "@/design-system/cn";
import { DISARM_AFTER_MS } from "@/design-system/hooks/use-armed";

/**
 * The time left on an armed confirmation, drawn as a line that drains.
 *
 * An armed button disarms itself after a few seconds so a mis-tap cannot fire
 * later. Nothing said so: hesitating over "encerrar o treino com 5 séries
 * pendentes?" — exactly the moment worth hesitating over — silently threw the
 * decision away and asked for the tap again.
 *
 * The duration comes from `DISARM_AFTER_MS`, so the bar cannot claim more time
 * than the timer allows.
 *
 * **Hidden under `prefers-reduced-motion`, in CSS rather than JavaScript.** The
 * global rule in `globals.css` collapses every animation to 0.01ms, which would
 * leave an already-drained bar reading as "expired" the instant it appeared.
 * The first version asked `useReducedMotion` and returned `null`, which made
 * every confirmation button in the app depend on `matchMedia` — and took
 * thirteen tests down with it. A variant does the same job with no hook, no
 * extra render and nothing to stub. The armed state still announces itself
 * through the colour and the changed label; this only adds the clock.
 */
export function DisarmProgress({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden
      style={{ animationDuration: `${String(DISARM_AFTER_MS)}ms` }}
      className={cn(
        "animate-drain pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left",
        "bg-current opacity-40 motion-reduce:hidden",
        className,
      )}
    />
  );
}
