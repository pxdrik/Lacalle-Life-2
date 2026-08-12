import { cn } from "@/design-system/cn";

/**
 * How much vertical room a screen opens with.
 *
 * `tight` is for the screens you arrive at already reading — Hoje, the diary,
 * a running workout — where a tall gap before the first card is a scroll
 * nobody asked for. `roomy` is for the ones you arrive at to choose something.
 */
type Padding = "tight" | "roomy";

const PADDING: Record<Padding, string> = {
  tight: "py-6 sm:py-10",
  roomy: "py-10 sm:py-14",
};

/**
 * The width every screen lives in.
 *
 * **1152px was the right answer until the sidebar existed.** It was measured
 * against a full-bleed window with a header on top; once 256px of that window
 * became a fixed column, the same cap left 725px of empty page on a 2133px
 * screen — measured in the browser, not estimated. The content read as a
 * narrow strip pinned beside a navigation rather than as the app.
 *
 * The cap is now 1920px, which on any ordinary screen is no cap at all — the
 * content simply fills what the sidebar left. 1536px was tried first and still
 * left 341px empty on a 2133px monitor, which is the same complaint one size
 * smaller. What the number still does is catch the ultrawide case, where a
 * meal row stretched across 3440px becomes a line no eye tracks to the end of.
 *
 * A cap that only engages on hardware most people do not own is the right
 * shape for this: it is a guard rail, not a layout.
 *
 * Written once here rather than spelled out on eleven pages, which is how the
 * eleven had already drifted into two different vertical paddings with no rule
 * saying which screen gets which.
 */
export function pageShell(padding: Padding = "roomy"): string {
  return cn("mx-auto w-full max-w-[120rem] px-6 lg:px-8", PADDING[padding]);
}

interface Props extends React.HTMLAttributes<HTMLElement> {
  readonly padding?: Padding;
}

/** The `main` element every route opens with. */
export function PageShell({ padding, className, ...props }: Props) {
  return <main className={cn(pageShell(padding), className)} {...props} />;
}
