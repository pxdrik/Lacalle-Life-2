import type { LucideIcon } from "lucide-react";

import { cn } from "@/design-system/cn";

interface Props {
  readonly title: string;
  readonly subtitle?: string | undefined;
  /**
   * The screen's mark, shown in a chip beside the title.
   *
   * Optional because a screen without an obvious glyph is better off with
   * none: an icon that has to be explained is worse than a plain title. Where
   * it fits, it is the fastest way to know which screen you landed on.
   */
  readonly icon?: LucideIcon | undefined;
  /** Sits opposite the title — a primary action, a count, a control. */
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
}

/**
 * The title block every screen opens with.
 *
 * Extracted because twelve files had spelled out the same three utilities by
 * hand, which meant the app had twelve chances to disagree with itself about
 * what a page title is — and no single place to fix the hierarchy when it
 * turned out to be the weakest thing in the design.
 *
 * **The type is the point.** A title one step up from body copy is not a
 * hierarchy, it is a slightly larger paragraph. This sets a real jump and
 * pulls the tracking in as the size grows, which is what stops large text
 * from reading as loose.
 *
 * It gets *smaller* on the desk, not larger: the phone shows one screen at a
 * time and the title orients you, while a desktop window already shows the
 * navigation, the content and its context at once.
 *
 * **The icon chip is where the brand is spent on an ordinary screen.** One
 * small saturated glyph on a neutral chip, once per page — the same logic that
 * took the emerald off every surface: concentrated, it reads as identity;
 * spread, it reads as a tint. The chip itself is `muted`, so the colour lands
 * on the glyph and nowhere else.
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: Props) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon !== undefined && (
          <span
            aria-hidden
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted text-accent-text md:size-8"
          >
            <Icon className="size-[1.125rem]" />
          </span>
        )}

        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance md:text-2xl md:tracking-[-0.025em]">
            {title}
          </h1>
          {subtitle !== undefined && (
            <p className="mt-1.5 text-ink-muted md:text-sm">{subtitle}</p>
          )}
        </div>
      </div>

      {children}
    </header>
  );
}
