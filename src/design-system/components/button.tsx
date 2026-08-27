import { cn } from "@/design-system/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * As quatro variantes da pág. 25, e nenhuma quinta.
 *
 * `danger` é só para ação destrutiva e irreversível — nunca como acento
 * decorativo. `secondary` tem borda de 1 px em Gray 300, e não a borda de card;
 * um controle de linha pede a borda mais forte.
 *
 * **Os hovers deixaram de ser opacidade.** `hover:opacity-90` clareava o verde
 * contra a página e, junto, reduzia o contraste do rótulo por um caminho que
 * nenhuma asserção de contraste enxerga — os tokens continuam medindo certo
 * enquanto o pixel na tela não. Agora cada um troca para uma cor que existe,
 * e `--accent-hover` explica a direção escolhida.
 *
 * Um bloco de lookup em vez de uma biblioteca de variantes: o conjunto é
 * pequeno e fechado, `satisfies` torna a exaustividade um erro de compilação, e
 * não custa nada em tempo de execução.
 */
const VARIANTS = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-muted",
  ghost: "text-ink-muted hover:bg-muted hover:text-ink",
  danger: "bg-danger text-danger-ink hover:bg-danger-text",
} satisfies Record<ButtonVariant, string>;

/**
 * As alturas e o padding vêm de `--control-h*`/`--control-px*`
 * (`tokens.css`), na proporção "1,5 × a altura ÷ 3" da pág. 25 — não mais
 * literalmente 48/40/32, desde que o Padrão do produto subiu um degrau
 * inteiro acima do da página (Pedro, 26/08/2026; ver o comentário em
 * `tokens.css` sobre por quê). A fórmula sobreviveu; os números de
 * referência da página, não.
 *
 * **Deixaram de variar por breakpoint**, e a decisão que os fazia variar
 * sobreviveu por outro caminho: um controle maior para o polegar suado entre
 * séries agora é o tamanho `lg`, que é o mesmo em todo lugar, contra o que o
 * celular tinha antes. É escolher o token certo em vez de mudar o token com
 * a tela.
 *
 * O ícone é 16 px com gap de 8 nos três tamanhos, também da pág. 25 — o gap não
 * encolhe junto com o botão, porque o que ele separa não encolheu.
 */
const SIZES = {
  sm: "h-(--control-h-sm) gap-2 rounded-md px-(--control-px-sm) text-[0.8125rem]",
  md: "h-(--control-h) gap-2 rounded-md px-(--control-px) text-sm",
  lg: "h-(--control-h-lg) gap-2 rounded-md px-(--control-px-lg) text-sm",
} satisfies Record<ButtonSize, string>;

/**
 * SemiBold 600, que é o peso que a pág. 16 atribui a botões e a pág. 25 repete.
 * Era Medium 500.
 *
 * `active:scale-[0.98]` vem da mesma página: "o active reduz a escala para
 * 0,98 — sem deslocamento vertical". Substitui um `active:opacity-80`, que
 * dizia a mesma coisa apagando o botão em vez de afundá-lo.
 *
 * **O desabilitado deixou de ser opacidade.** A pág. 27 é explícita: "opacidade
 * não é suficiente: reduzir contraste e remover interação". Um primário a 45%
 * de opacidade continua sendo um bloco verde, só que lavado — parece quebrado,
 * não desligado. Agora ele vira superfície neutra com texto terciário, que é
 * como um controle desligado se parece, e `pointer-events-none` garante o
 * resto da regra: "não muda de cor no hover e mantém o cursor padrão".
 */
const BASE = cn(
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap",
  "font-semibold transition-[background-color,border-color,color,scale]",
  "duration-(--duration-micro) ease-out active:scale-[0.98]",
  "disabled:pointer-events-none disabled:border-transparent",
  "disabled:bg-muted disabled:text-ink-subtle disabled:active:scale-100",
);

/**
 * The button's looks, without the button.
 *
 * For the handful of places where the thing is genuinely a link — it changes
 * the address, it should open in a new tab on middle click, it belongs in the
 * browser's history — but reads as the primary action. Wrapping a `Link` in a
 * `Button` would nest an anchor in a button, which no assistive technology can
 * make sense of; giving the `Link` these classes keeps the element honest.
 *
 * Same reasoning as `CARD_SURFACE`, and the same trade: one exported recipe
 * beats a second component that drifts.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size]);
}

export interface ButtonProps extends Omit<
  React.ComponentPropsWithRef<"button">,
  "type"
> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /**
   * Work is in flight. Writes here are local and usually finish in a
   * millisecond, so this deliberately dims and blocks rather than showing a
   * spinner — a spinner that appears for one frame reads as a glitch.
   */
  readonly pending?: boolean;
  /**
   * Narrowed from the DOM default of `"submit"`. A button inside a form that
   * silently submits it is one of the oldest bugs in web UI; opting into
   * submission has to be explicit.
   */
  readonly type?: "button" | "submit" | "reset";
}

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  type = "button",
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || pending}
      aria-busy={pending || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}
