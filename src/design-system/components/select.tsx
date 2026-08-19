"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/design-system/cn";

type SelectVariant = "default" | "compact";

/**
 * `default` matches `Input` — 44 px, full width, the size a labelled form
 * field wants. `compact` is for a select living inside a dense row it does
 * not control the width of: the unit beside a portion, RPE beside a set.
 *
 * Named `variant`, not `size` — `<select>` already has a native `size`
 * attribute (visible option rows), and shadowing it would make this
 * component silently swallow a real HTML prop.
 */
const SIZES: Record<SelectVariant, string> = {
  default: "h-(--input-h) w-full pl-(--input-px) pr-8 text-base md:text-sm",
  compact: "h-8 pl-2 pr-6 text-sm",
};

const CHEVRON: Record<SelectVariant, string> = {
  default: "right-3 size-4",
  compact: "right-1.5 size-3.5",
};

interface Props extends React.ComponentPropsWithRef<"select"> {
  readonly variant?: SelectVariant;
}

/**
 * A `<select>` with a chevron drawn in the app's own hand.
 *
 * The unstyled browser default was the actual complaint — "meio invisível",
 * against a screen where every other control has a border and a hover state.
 * `appearance-none` removes the native arrow (and, in Chrome, the native
 * background) so this can draw both itself, matching `Input` down to the
 * border colour and the focus ring.
 *
 * **Still a real `<select>`, not a custom listbox.** The popup itself stays
 * out of reach on purpose — `RpeSelect` already made this case: a native
 * select is keyboard operable and opens the OS picker on a phone for free,
 * which a hand-built dropdown would have to earn back one bug at a time.
 * This component only ever restyles the closed trigger.
 */
export function Select({ variant = "default", className, ...props }: Props) {
  return (
    <span
      className={cn(
        "relative inline-flex",
        variant === "default" && "w-full",
      )}
    >
      <select
        {...props}
        className={cn(
          "appearance-none rounded-md border border-line-strong bg-surface text-ink",
          "transition-colors duration-(--duration-micro) ease-out",
          "hover:border-ink-subtle focus:border-accent",
          "disabled:cursor-not-allowed disabled:border-line disabled:bg-muted disabled:text-line-strong",
          SIZES[variant],
          className,
        )}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-subtle",
          CHEVRON[variant],
        )}
      />
    </span>
  );
}
