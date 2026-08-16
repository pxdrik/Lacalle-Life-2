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
 * hierarchy, it is a slightly larger paragraph. This sets a real jump, and the
 * jump alone carries it.
 *
 * **O estilo agora é o H1 da pág. 17, e isso reverte duas decisões daqui.**
 *
 * O tracking era normal, e o comentário que o defendia dizia que tracking
 * apertado "é a convenção de uma neo-grotesca como a Geist, e o oposto do
 * wordmark, cujas letras são largas e quase circulares". As duas premissas
 * caíram: a tipografia não é mais Geist, é Inter, e o wordmark da pág. 10 é
 * Inter Bold com tracking de **−3%**. Apertar o título aproxima os dois em vez
 * de afastá-los. O peso volta a 700 pelo mesmo motivo.
 *
 * E ele voltou a **crescer** na mesa em vez de encolher. Encolher era uma
 * decisão defensável — o celular mostra uma tela por vez e o título orienta —
 * mas a tabela da pág. 32 é explícita na direção contrária: H1 em 24 no
 * celular, 28 no tablet, 32 no desktop. No celular ele fica no estilo H2, que é
 * o próprio passo de 24 da escala com o entrelinhamento que aquele tamanho
 * pede.
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
          <h1 className="text-h2 font-bold text-balance md:text-h1">
            {title}
          </h1>
          {subtitle !== undefined && (
            <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
          )}
        </div>
      </div>

      {children}
    </header>
  );
}
