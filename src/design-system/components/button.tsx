import { cn } from "@/design-system/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Variants are a plain lookup rather than a variants library. The set is
 * small and closed, `satisfies` makes exhaustiveness a compile error, and it
 * costs nothing at runtime.
 */
const VARIANTS = {
  primary: "bg-accent text-accent-ink hover:opacity-90 active:opacity-80",
  secondary:
    "bg-surface text-ink border border-line hover:bg-muted hover:border-line-strong",
  ghost: "text-ink-muted hover:bg-muted hover:text-ink",
  danger: "bg-danger text-danger-ink hover:opacity-90 active:opacity-80",
} satisfies Record<ButtonVariant, string>;

/**
 * Heights come from the density tokens, so a button is a comfortable thumb
 * target on a phone and a compact control at a desk without either size being
 * spelled out here. `lg` is the mid-set tap — finishing a workout, marking a
 * set — and stays the largest in both worlds.
 */
const SIZES = {
  sm: "h-(--control-h-sm) gap-1.5 rounded-md px-3 text-sm",
  md: "h-(--control-h) gap-2 rounded-md px-(--control-px) text-sm",
  lg: "h-(--control-h-lg) gap-2 rounded-md px-5 text-base md:text-sm",
} satisfies Record<ButtonSize, string>;

const BASE =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap " +
  "font-medium transition-[background-color,border-color,color,opacity] " +
  "duration-150 ease-out disabled:pointer-events-none disabled:opacity-45";

/**
 * The button's looks, without the button.
 *
 * For the handful of places where the thing is genuinely a link — it changes
 * the address, it should open in a new tab on middle click, it belongs in the
 * browser's history — but reads as the primary action. Wrapping a `Link` in a
 * `Button` would nest an anchor in a button, which no assistive technology can
 * make sense of; giving the `Link` these classes keeps the element honest.
 *
 * Same reasoning as `CARD_SURFACE`, and the same trade: one exported recipe
 * beats a second component that drifts.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size]);
}

export interface ButtonProps extends Omit<
  React.ComponentPropsWithRef<"button">,
  "type"
> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /**
   * Work is in flight. Writes here are local and usually finish in a
   * millisecond, so this deliberately dims and blocks rather than showing a
   * spinner — a spinner that appears for one frame reads as a glitch.
   */
  readonly pending?: boolean;
  /**
   * Narrowed from the DOM default of `"submit"`. A button inside a form that
   * silently submits it is one of the oldest bugs in web UI; opting into
   * submission has to be explicit.
   */
  readonly type?: "button" | "submit" | "reset";
}

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  type = "button",
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || pending}
      aria-busy={pending || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}
