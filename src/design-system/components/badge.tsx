import { cn } from "@/design-system/cn";

/**
 * The five states a badge can name — the grammar the Sprint 8 direction
 * document calls for, formalised as a closed set rather than a free-form
 * `tone` prop a call site could misuse into decoration.
 *
 * `proximo` is the one entry that is not a `Notice` tone: it is structural
 * green — "in progress", "next up" — kept distinct from `concluido`
 * (semantic green, only ever "this is actually done"). The two must never
 * collapse into one shade of green, which is the whole point of naming them
 * separately here instead of leaving call sites to reuse `accent` for both.
 */
export type BadgeState = "neutro" | "proximo" | "atencao" | "concluido" | "negativo";

const STATES: Record<BadgeState, string> = {
  neutro: "border-line-strong bg-muted text-ink-muted",
  proximo: "border-accent/30 bg-accent/10 text-accent-text",
  atencao: "border-warning/30 bg-warning-surface text-warning-text",
  concluido: "border-accent/30 bg-accent/10 text-accent-text",
  negativo: "border-danger/30 bg-danger-surface text-danger-text",
};

interface Props {
  readonly state: BadgeState;
  /**
   * Required, on purpose. A badge that only carried colour would fail
   * exactly the reader the rest of the system already writes for — someone
   * who cannot separate amber from green, or is reading in direct sun.
   */
  readonly children: string;
  readonly className?: string;
}

export function Badge({ state, children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
        STATES[state],
        className,
      )}
    >
      {children}
    </span>
  );
}
