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

const SIZES = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-sm",
  md: "h-10 gap-2 rounded-md px-4 text-sm",
  // 44px, the minimum comfortable touch target — this is the size the
  // workout screen uses, where the tap happens one-handed and mid-set.
  lg: "h-11 gap-2 rounded-lg px-5 text-base",
} satisfies Record<ButtonSize, string>;

const BASE =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap " +
  "font-medium transition-[background-color,border-color,color,opacity] " +
  "duration-150 ease-out disabled:pointer-events-none disabled:opacity-45";

export interface ButtonProps
  extends Omit<React.ComponentPropsWithRef<"button">, "type"> {
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
      data-pending={pending || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}
