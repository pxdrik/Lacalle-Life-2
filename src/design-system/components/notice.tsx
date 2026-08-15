import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/design-system/cn";

/**
 * What a notice is saying, and how much it should interrupt.
 *
 * Four tones, and only two of them are new colours. **Success is the accent
 * and error is `danger`**, for the reason recorded in `tokens.css`: a second
 * green beside a green brand is not a state, it is noise.
 *
 * **As superfícies são as da pág. 27**, nomeadas lá uma a uma — `#FEF2F2`,
 * `#FFFBEB`, `#F3F4F6`, `#ECFDF5`. Eram o próprio tom a 5% de opacidade, que
 * chegava perto no tema claro e errado no escuro: 5% de vermelho sobre
 * quase-preto é quase-preto, e o aviso perdia a superfície que o distingue do
 * fundo. Os tokens `-surface` já resolvem os dois temas.
 *
 * `role` is part of the tone rather than a prop, because it is not a styling
 * choice. An `alert` interrupts a screen reader mid-sentence; a `status` waits
 * its turn. Something went wrong earns the interruption — "here is a note
 * about fibre" does not, and making that decision at each call site is how an
 * app ends up shouting its footnotes.
 */
const TONES = {
  danger: {
    box: "border-danger/30 bg-danger-surface",
    mark: "text-danger",
    Icon: CircleAlert,
    role: "alert",
  },
  warning: {
    box: "border-warning/30 bg-warning-surface",
    mark: "text-warning",
    Icon: TriangleAlert,
    role: "alert",
  },
  info: {
    box: "border-info/30 bg-info-surface",
    mark: "text-info",
    Icon: Info,
    role: "status",
  },
  success: {
    box: "border-accent/30 bg-success-surface",
    mark: "text-accent-text",
    Icon: CircleCheck,
    role: "status",
  },
} as const;

export type NoticeTone = keyof typeof TONES;

/**
 * How much room it takes.
 *
 * `inline` is a line of text in the flow of a screen that is otherwise fine —
 * a write that failed while everything else still works. `block` is the screen
 * itself failing, so it stands in place of the content that cannot load.
 */
export type NoticeLayout = "inline" | "block";

/**
 * The definition, for the call sites that must stay some other element — a
 * `<p>` that is already positioned, a container that owns its own layout.
 * Exported for the same reason `CARD_SURFACE` is: so those places share this
 * definition instead of re-typing it and drifting.
 */
export function noticeClasses(
  tone: NoticeTone = "danger",
  layout: NoticeLayout = "inline",
): string {
  return cn(
    "border",
    TONES[tone].box,
    layout === "inline"
      ? "rounded-lg px-4 py-3 text-sm text-ink"
      : "rounded-lg px-6 py-8 text-center",
  );
}

interface Props {
  readonly tone?: NoticeTone;
  readonly layout?: NoticeLayout;
  /** The headline. Omitted when the notice is a single sentence. */
  readonly title?: string | undefined;
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
}

/**
 * A tinted box that says what happened.
 *
 * Extracted because nineteen files spelled out the same five utilities by
 * hand, all of them in red. That is nineteen chances for the app to disagree
 * with itself about what a problem looks like — and, more to the point, it
 * meant every state the app could report was the same state: a failed save, a
 * catalogue that would not load and a gentle note all arrived identical.
 *
 * **The icon is not decoration; it is the part that survives.** Colour alone
 * fails anyone who cannot separate red from amber, and it fails everyone in
 * bright sunlight holding a phone between sets. The glyph carries the tone
 * where the hue cannot.
 */
export function Notice({
  tone = "danger",
  layout = "inline",
  title,
  children,
  className,
}: Props) {
  const { Icon, mark, role } = TONES[tone];

  if (layout === "block") {
    return (
      <div role={role} className={cn(noticeClasses(tone, layout), className)}>
        <Icon aria-hidden className={cn("mx-auto size-6", mark)} />
        {title !== undefined && <p className="mt-3 text-ink">{title}</p>}
        {children !== undefined && (
          <div className="mt-1.5 text-sm text-ink-muted">{children}</div>
        )}
      </div>
    );
  }

  return (
    <div
      role={role}
      className={cn(
        noticeClasses(tone, layout),
        "flex items-start gap-2.5",
        className,
      )}
    >
      <Icon aria-hidden className={cn("mt-px size-4 shrink-0", mark)} />
      <div className="min-w-0">
        {title !== undefined && <p className="text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}
