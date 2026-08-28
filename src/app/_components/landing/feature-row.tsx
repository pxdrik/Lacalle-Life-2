import type { LucideIcon } from "lucide-react";

import { cn } from "@/design-system/cn";

interface Props {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly text: string;
  readonly bullets: readonly string[];
  readonly visual: React.ReactNode;
  /** Alterna o lado do texto a cada seção, para a tela não virar uma coluna
   * única repetindo o mesmo layout três vezes. */
  readonly reverse?: boolean;
}

/**
 * Uma seção de funcionalidade: texto de um lado, um painel do outro que
 * reaproveita a aparência real do produto (cores, raio, tipografia dos
 * tokens) em vez de um mockup genérico ou uma foto de banco de imagens — o
 * pedido pede para priorizar "elementos da própria interface", e não existe
 * screenshot real para embutir numa página estática sem arriscar ficar
 * desatualizado a cada mudança de tela.
 */
export function FeatureRow({ icon: Icon, title, text, bullets, visual, reverse = false }: Props) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16",
        reverse && "lg:[&>:first-child]:order-2",
      )}
    >
      <div>
        <span className="flex size-11 items-center justify-center rounded-lg bg-accent-surface text-accent-text">
          <Icon aria-hidden className="size-5" />
        </span>
        <h2 className="mt-5 text-h2 font-bold text-ink">{title}</h2>
        <p className="mt-3 max-w-md text-ink-muted">{text}</p>

        <ul className="mt-6 space-y-2.5">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm text-ink-muted">
              <span
                aria-hidden
                className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-text"
              />
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      <div>{visual}</div>
    </div>
  );
}
