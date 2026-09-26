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
 * Three sizes, e cada uma é um registro de verdade, não um degrau de escala:
 * `default` é título de nível de página (com divisor próprio, "Treinos" em
 * `/evolucao`); `sub` nomeia um grupo **dentro** de uma seção já
 * estabelecida, e é o mais usado do app; `compact` é o rótulo em caixa alta
 * de um agrupamento leve, como "Alimentação" sob o herói de Hoje. Mesma
 * gramática, volumes diferentes — não três componentes.
 *
 * **`sub` entrou na Sprint 5, depois de a auditoria contar nove títulos
 * escritos à mão com as mesmas três classes** (`text-sm font-medium
 * text-ink`), espalhados por Evolução, perfil, aderência e o seletor de
 * alimentos. Nove cópias de uma decisão é nove chances de divergir, e a
 * primeira divergência já existia: alguns traziam subtítulo em `ink-subtle`
 * e este componente pintava o seu de `ink-muted`.
 *
 * O que **não** virou `sub`, e o porquê — a auditoria olhou cada ocorrência
 * em vez de casar por classe:
 *
 * - `backup-panel` usa `text-sm font-semibold` num `h2` **dentro de um
 *   card**, com um `h3` irmão no mesmo peso. É uma hierarquia local
 *   coerente, não um desvio: título de card não é título de seção.
 * - `macro-split-dialog` usa as mesmas classes num `<span>` que rotula uma
 *   linha. É label, não cabeçalho; tem o tamanho por coincidência.
 */
type SectionSize = "default" | "sub" | "compact";

const TITLE: Record<SectionSize, string> = {
  default: "text-lg font-semibold tracking-tight text-ink",
  sub: "text-sm font-medium text-ink",
  compact: "text-xs font-medium tracking-wide text-ink-subtle uppercase",
};

/**
 * O espaço entre o cabeçalho e o conteúdo, por tamanho.
 *
 * `sub` usa 12px porque é o que os nove consumidores que ele substitui já
 * escreviam à mão (`mt-3`). Adotar o 10px de `compact` teria deslocado todos
 * eles dois pixels em nome de uma simetria que ninguém pediu — a migração
 * existe para tirar a duplicação, não para mexer no desenho.
 */
const GAP: Record<SectionSize, string> = {
  default: "mt-6",
  sub: "mt-3",
  compact: "mt-2.5",
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
          {/* `ink-subtle`, não `ink-muted` — Sprint 5.
              `tokens.css` reparte os cinzas por função e é literal: "Ink para
              corpo, Gray 700 para o secundário de leitura, Gray 500 para
              labels, captions e placeholders". Um subtítulo de seção é
              caption: ele descreve o grupo, ninguém precisa lê-lo para usar a
              tela. Este componente era o único lugar do app que o tratava
              como texto de leitura, e os títulos escritos à mão que ele passa
              a substituir já usavam `ink-subtle`. Dois consumidores mudam de
              tom (as duas seções de `/evolucao`), na direção do token que a
              própria função pede. */}
          {subtitle !== undefined && (
            <p
              className={cn(
                "text-ink-subtle",
                size === "default" ? "mt-1 text-sm" : "mt-0.5 text-xs",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className={GAP[size]}>{children}</div>
    </section>
  );
}
