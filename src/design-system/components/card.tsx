import { cn } from "@/design-system/cn";

/**
 * The elements a card is allowed to be.
 *
 * Kept to a closed list rather than a generic polymorphic component: the point
 * of choosing the element is semantics — a chart is a `figure`, a set of
 * labelled totals is a `dl`, an exercise is a `section` — and a generic `as`
 * that accepts anything invites `<Card as="span">` wrapping block content.
 */
type CardElement = "div" | "section" | "article" | "figure" | "dl";

/**
 * Attributes are typed against `HTMLElement`, not `HTMLDivElement`: the
 * div-specific version makes every event handler expect a div, which a `dl`
 * or a `figure` is not, and the error surfaces at the call site rather than
 * here.
 */
interface Props extends React.HTMLAttributes<HTMLElement> {
  readonly as?: CardElement;
}

/**
 * A raised surface.
 *
 * Extracted because thirteen files spelled out the same four utilities by hand.
 * That is thirteen chances for the app to disagree with itself about what a
 * card is, and — the reason this exists now — thirteen places to edit every
 * time the answer changes.
 *
 * **The padding comes from the density layer**, so a card is roomy in the hand
 * and tight at the desk without either number appearing here. The execution
 * screen's card gets *more* padding on a phone than it used to, which is the
 * point: that is the card someone reads standing up between sets.
 *
 * The hairline along the top edge is invisible in light mode, where the border
 * already reads, and does the real work in dark mode — it is what keeps a card
 * from looking like a hole cut in the page. It lives here rather than in a
 * global rule because a global `.bg-surface::before` would also hit inputs and
 * buttons, and `::before` does not exist on replaced elements.
 */
/**
 * The definition itself, for the handful of surfaces that must be some other
 * element entirely — a whole-card `Link`, for instance, which has to stay an
 * anchor to remain a link. Exported so those places share this definition
 * rather than re-typing it and drifting.
 */
export const CARD_SURFACE = cn(
  "relative rounded-xl border border-line bg-surface p-(--card-p)",
  "before:pointer-events-none before:absolute before:inset-x-px before:top-0",
  "before:h-px before:bg-(--card-top-light)",
);

export function Card({ as: Tag = "div", className, ...props }: Props) {
  return <Tag className={cn(CARD_SURFACE, className)} {...props} />;
}
