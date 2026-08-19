import { cn } from "@/design-system/cn";

/**
 * A titled group of content with no card around it.
 *
 * Extracted from `/evolucao`, the one screen that already spelled this out by
 * hand (`app/evolucao/page.tsx`) — the proof that a group of content can rank
 * without a border was already shipping, just not reusable. `Card` answers
 * "how does this look"; `Section` answers "how is this named" — a screen
 * reaches for it when content needs a heading and *not* a surface, which
 * `Card` cannot say without also drawing a box nobody asked for.
 *
 * Two sizes because the one existing instance and the one this was built for
 * are genuinely different registers: `default` is a page-level heading (own
 * top divider, `Treinos` inside `/evolucao`), `compact` is a lighter label
 * for a grouping that lives inside an already-established screen, such as
 * "Alimentação" or "Treino" under Hoje's hero. Same grammar, different
 * volume — not two components.
 */
type SectionSize = "default" | "compact";

const TITLE: Record<SectionSize, string> = {
  default: "text-lg font-semibold tracking-tight text-ink",
  compact: "text-xs font-medium tracking-wide text-ink-subtle uppercase",
};

interface Props {
  readonly title: string;
  readonly subtitle?: string;
  /** Content aligned with the title — a link, a count. Never a second title. */
  readonly action?: React.ReactNode;
  readonly size?: SectionSize;
  /** The top rule and spacing `/evolucao` uses to separate one section from the next. Off by default: a screen with one section, or a `compact` grouping inside a hero, draws its own rhythm. */
  readonly divider?: boolean;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function Section({
  title,
  subtitle,
  action,
  size = "default",
  divider = false,
  children,
  className,
}: Props) {
  return (
    <section className={cn(divider && "mt-12 border-t border-line pt-10", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className={TITLE[size]}>{title}</h2>
          {subtitle !== undefined && (
            <p
              className={cn(
                "text-ink-muted",
                size === "default" ? "mt-1 text-sm" : "mt-0.5 text-xs",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className={size === "default" ? "mt-6" : "mt-2.5"}>{children}</div>
    </section>
  );
}
