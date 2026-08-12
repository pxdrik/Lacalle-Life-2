import { cn } from "@/design-system/cn";

/**
 * The elements a card is allowed to be.
 *
 * Kept to a closed list rather than a generic polymorphic component: the point
 * of choosing the element is semantics — a chart is a `figure`, a set of
 * labelled totals is a `dl`, an exercise is a `section`, a history is a `ul`,
 * one routine among several is an `li` — and a generic `as` that accepts
 * anything invites `<Card as="span">` wrapping block content.
 */
type CardElement =
  | "div"
  | "section"
  | "article"
  | "figure"
  | "dl"
  | "ul"
  | "li";

/**
 * How much presence the card has.
 *
 * Added because the app had exactly one kind of surface, and a screen where
 * the day's headline figure, a list of meals and a footnote are all the same
 * bordered box is a screen with no ranking on it. The reader has to read
 * everything to find out what matters.
 *
 * `hero` and `default` differ by **surface and light, never by geometry**:
 * same radius, same padding, because a card that is also a different shape
 * stops reading as the same family. Depth is the same tool the tokens already
 * use — a step of lightness in the dark theme, a shadow in the light one, and
 * the top hairline that makes a surface look raised rather than cut out.
 *
 * `hero` is the one thing a screen exists to show — at most one per screen, or
 * it means nothing. It sits on `elevated`, one step above every other card.
 *
 * `quiet` is the surface for a card with nothing in it yet: a dashed outline
 * and no fill. **The app already spoke this dialect** — five screens had the
 * dashed box written out by hand — so this is where the recipe now lives
 * rather than a style invented here. It is the one tone that sets its own
 * padding, because those five had disagreed about it (`py-12` against
 * `py-14`), and because an empty state is mostly deliberate whitespace: the
 * card's usual padding around three lines of text reads as a cramped error
 * rather than as room waiting to be filled.
 */
type CardTone = "hero" | "default" | "quiet";

/**
 * The recipe per tone. Only the fill, the shadow and the hairline vary.
 *
 * `hero` reaches for `--elevated`, which in the light theme is the same white
 * as `--surface` — there is nothing above white — so there the lift is carried
 * by the shadow instead. That asymmetry is the theme being honest rather than
 * mirrored: dark surfaces rise by getting lighter because shadows do not read
 * on near-black, and light ones rise by casting one.
 *
 * `quiet` sets no fill and no hairline: the pseudo-element is still positioned
 * by the base recipe, and with nothing painted into it there is nothing to see.
 * Its border is dashed — the one place the app draws an incomplete edge, for
 * the one place where the content is genuinely absent rather than quiet.
 */
const TONES: Record<CardTone, string> = {
  hero: "border-line bg-elevated shadow-md before:bg-(--card-top-hero)",
  default: "border-line bg-surface before:bg-(--card-top-light)",
  quiet: "border-dashed border-line",
};

/** See `CardTone`: only the empty state departs from the density token. */
const PADDING: Record<CardTone, string> = {
  hero: "p-(--card-p)",
  default: "p-(--card-p)",
  quiet: "px-6 py-12",
};

interface Props extends React.HTMLAttributes<HTMLElement> {
  readonly as?: CardElement;
  readonly tone?: CardTone;
  /**
   * Off for surfaces whose content draws its own edges — a list of rows with
   * dividers, where the padding belongs to the row so that a hover highlight
   * reaches the full width of the card instead of floating inside it.
   */
  readonly padded?: boolean;
}

/**
 * A raised surface.
 *
 * Extracted because thirteen files spelled out the same four utilities by hand.
 * That is thirteen chances for the app to disagree with itself about what a
 * card is, and — the reason this exists now — thirteen places to edit every
 * time the answer changes. The list containers were the proof: written by hand,
 * they never got the top hairline, so in the dark theme the food list read as a
 * hole cut in the page while the cards beside it read as raised.
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
export function Card({
  as: Tag = "div",
  tone = "default",
  padded = true,
  className,
  ...props
}: Props) {
  return <Tag className={cn(cardSurface(tone, padded), className)} {...props} />;
}

/**
 * The definition itself, for the handful of surfaces that must be some other
 * element entirely — a whole-card `Link`, for instance, which has to stay an
 * anchor to remain a link. Exported so those places share this definition
 * rather than re-typing it and drifting.
 */
export function cardSurface(tone: CardTone = "default", padded = true): string {
  return cn(
    "relative rounded-xl border",
    "before:pointer-events-none before:absolute before:inset-x-px before:top-0",
    "before:h-px",
    TONES[tone],
    padded && PADDING[tone],
  );
}
