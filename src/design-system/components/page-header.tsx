import { cn } from "@/design-system/cn";

interface Props {
  readonly title: string;
  readonly subtitle?: string | undefined;
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
 */
export function PageHeader({ title, subtitle, children, className }: Props) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance md:text-2xl md:tracking-[-0.025em]">
          {title}
        </h1>
        {subtitle !== undefined && (
          <p className="mt-1.5 text-ink-muted md:text-sm">{subtitle}</p>
        )}
      </div>

      {children}
    </header>
  );
}
