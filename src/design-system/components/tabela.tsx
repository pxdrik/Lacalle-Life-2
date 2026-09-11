import { Card } from "@/design-system/components/card";
import { cn } from "@/design-system/cn";

interface NumericColumn {
  readonly key: string;
  readonly label: string;
  /** Must match the width class the row itself uses for the same value. */
  readonly width: string;
}

interface Props {
  /** The header cell for the flexible leading column — the row's own subject, not a unit label like "Nome". */
  readonly primaryLabel: string;
  /** Right-aligned, fixed-width columns, in the order the row draws them. */
  readonly columns: readonly NumericColumn[];
  /**
   * Widths of any fixed, unlabelled cells the row reserves after `columns`
   * for its own actions (a favourite star, edit/delete) — each one, in
   * order, so the header's empty space lines up with what the row actually
   * draws there instead of guessing a single combined width.
   */
  readonly trailingSpacers?: readonly string[];
  /** The floor width that makes the table scroll sideways instead of squeezing a column unreadable. */
  readonly minWidth?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}

/**
 * Mantém forma de planilha sem ser uma `<table>`: `Card` + cabeçalho de
 * coluna com `aria-hidden` (ele rotula a lista, cada linha já lê como frase
 * completa pro leitor de tela) + `<ul>` de linhas com `divide-y`, dentro de
 * um `overflow-x-auto` com piso de largura — rola de lado numa tela
 * estreita em vez de espremer coluna até ficar ilegível (achado real num
 * iPhone do Pedro, 26/08/2026).
 *
 * Promovido de `FoodList`/`ColumnHeader` (brandbook, seção 43): a única
 * coisa que ficava lá que não pertence aqui é a linha em si — `FoodRow` é
 * inerentemente sobre alimento, então continua na feature. O que se
 * promove é só o molde: cabeçalho + moldura + rolagem.
 *
 * **Corrige um desalinhamento real, achado ao extrair.** O `ColumnHeader`
 * original reservava um `w-8` no INÍCIO (sobra de quando a estrela de
 * favorito ficava lá, antes da auditoria de 02/09/2026 mover essa ação pro
 * fim da linha) e só `w-16` no fim — mas a linha real reserva `w-8`
 * (estrela) *e depois* `w-16` (editar/excluir) no fim, nada no início.
 * Como nenhum teste cobre alinhamento de coluna a coluna, o cabeçalho
 * inteiro estava desenhado ~44px à direita de onde a linha realmente
 * começa. `trailingSpacers` existe para que essa reserva viva no lugar
 * certo, um valor por elemento fixo que a linha desenha depois das colunas
 * numéricas, na mesma ordem.
 */
export function Tabela({
  primaryLabel,
  columns,
  trailingSpacers = [],
  minWidth = "min-w-[26rem]",
  children,
  className,
}: Props) {
  return (
    <Card padded={false} className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <div className={cn(minWidth, "pt-3")}>
          <div
            aria-hidden
            className="flex items-center gap-3 border-b border-line px-3 pb-2 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
          >
            <span className="flex-1 truncate">{primaryLabel}</span>
            <span className="flex shrink-0 gap-3 sm:gap-4">
              {columns.map(({ key, label, width }) => (
                <span key={key} className={cn(width, "text-right")}>
                  {label}
                </span>
              ))}
            </span>
            {trailingSpacers.map((width, index) => (
              // A fixed, ordered layout list — never reordered or filtered — so the index is a stable key.
              <span key={`trailing-${String(index)}`} className={cn(width, "shrink-0")} />
            ))}
          </div>
        </div>

        <ul className={cn(minWidth, "divide-y divide-line")}>{children}</ul>
      </div>
    </Card>
  );
}
