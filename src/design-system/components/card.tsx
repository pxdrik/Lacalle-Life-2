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
 * **`hero` changed mechanism, not meaning.** It used to rise by light: a deeper
 * shadow in the light theme, a lighter surface and a brighter top hairline in
 * the dark one. Page 24 of the brand system forbids both halves of that — "não
 * fazer: sombras difusas ou coloridas" and "dois estilos de card diferentes na
 * mesma tela" — and names the replacement in the same breath: `CARD DESTACADO`
 * is the standard card with a **3 px indicator down its leading edge** and its
 * left padding opened from 20 to 24. Everything else is identical to `default`,
 * which is the point the old version was trying to make with light.
 *
 * It stays the one thing a screen exists to show — at most one per screen, or
 * it means nothing.
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
 * The recipe per tone, and it is deliberately thin now.
 *
 * All three share one radius, one border and one fill, because the brand system
 * asks for exactly one card. What varies is a 3 px indicator and a dashed edge —
 * and note that the indicator is drawn with a border rather than a
 * pseudo-element, so it participates in the corner radius instead of squaring
 * off the leading edge.
 */
const TONES: Record<CardTone, string> = {
  hero: "border-line bg-surface border-l-[3px] border-l-accent",
  default: "border-line bg-surface",
  quiet: "border-dashed border-line",
};

/**
 * See `CardTone`. `hero` opens its leading padding to 24 px, as page 24
 * specifies — the indicator would otherwise sit on top of the content instead
 * of beside it. The empty state is the only tone that departs from the density
 * token entirely.
 */
const PADDING: Record<CardTone, string> = {
  hero: "p-(--card-p) pl-6",
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
 * **The padding comes from the density layer**, so a card is 16 px in the hand
 * and 20 px from the tablet up — the one component measurement page 32 varies
 * by breakpoint, and the only one this file reads.
 *
 * The top hairline that used to be drawn here is gone with the shadow it
 * partnered: page 33 communicates elevation "por superfície mais clara, nunca
 * por sombra", and with a single card style there is no second surface to
 * separate from.
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
  return cn("relative rounded-lg border", TONES[tone], padded && PADDING[tone]);
}
