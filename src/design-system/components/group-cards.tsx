import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";

export interface GroupCard<K extends string> {
  /** `null` é "Todos": volta para o catálogo inteiro. */
  readonly key: K | null;
  readonly label: string;
  readonly count: number;
}

/**
 * Atalhos para os grupos de um catálogo, em cartões (roadmap 10.1 e 10.5,
 * 30/09/2026). A regra que o Pedro fechou: **cartão = ir para um grupo do
 * catálogo; pílula = filtrar ou escolher**. Os grupos de exercício e as
 * categorias de alimento usam esta peça; os filtros continuam em pílulas.
 *
 * Nome em cima do número, para caber numa coluna estreita. Duas grades:
 *
 * - `"four"`: 4 colunas, para nomes curtos ("Peito", "Ombros").
 * - `"three"`: 3 colunas, que caem para 2 quando a grade fica estreita demais
 *   para o nome mais longo ("Carboidratos"): medido, em 4 colunas ele não
 *   cabe já em 360px, e em 3 não cabe em 320px Confortável.
 *
 * Em ambas, o cartão mede a si mesmo (`@container`): estreito, o nome desce
 * para 12px; com espaço, fica nos 14px. Sem respiro lateral: com ele,
 * "Ombros" tinha folga zero e ganhava reticências em 320px Confortável.
 */
export function GroupCards<K extends string>({
  label,
  cards,
  active,
  onSelect,
  columns,
}: {
  /** O nome do grupo de botões, para leitor de tela ("Grupos musculares"). */
  readonly label: string;
  readonly cards: readonly GroupCard<K>[];
  readonly active: K | null;
  readonly onSelect: (key: K | null) => void;
  readonly columns: "four" | "three";
}) {
  return (
    <div className={cn(columns === "three" && "@container")}>
      <div
        role="group"
        aria-label={label}
        className={cn(
          "grid gap-1.5",
          columns === "four" ? "grid-cols-4" : "grid-cols-2 @min-[18.75rem]:grid-cols-3",
        )}
      >
        {cards.map((card) => {
          const selected = card.key === active;
          return (
            <button
              key={card.label}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onSelect(card.key);
              }}
              className={cn(
                "@container flex min-h-15 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-0 py-2 text-center",
                "transition-colors duration-150 ease-out",
                selected
                  ? "border-accent bg-accent-surface text-accent-text"
                  : "border-line bg-surface text-ink hover:border-line-strong",
              )}
            >
              <span className="max-w-full truncate text-xs font-medium @min-[4.5rem]:text-sm">
                {card.label}
              </span>
              <span className={cn("text-xs tabular-nums", selected ? "text-accent-text" : "text-ink-subtle")}>
                {formatDecimal(card.count)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
