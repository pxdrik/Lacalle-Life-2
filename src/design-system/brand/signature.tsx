import { cn } from "@/design-system/cn";

import { MARK_PATH, MARK_VIEWBOX } from "./mark";

/**
 * O símbolo, em uma cor só.
 *
 * `currentColor` e não um token: a pág. 13 lista as versões permitidas e todas
 * são monocromáticas — Ink, branco, cinza, ou sobre acento sólido. Herdar a cor
 * do texto é o que faz cada uma dessas sair de graça, e é também o que impede a
 * versão proibida, porque não há onde escrever uma segunda cor.
 *
 * **O símbolo nunca é recolorido no acento** (pág. 8). Quem chamar isto dentro
 * de algo verde recebe a marca em cima do verde, não a marca *feita* de verde.
 *
 * `aria-hidden` por padrão: nas duas superfícies onde ele aparece o nome está
 * escrito ao lado, e um `<img>` chamado "LaCalle" seguido do texto "LaCalle" é
 * a mesma palavra duas vezes para quem ouve a tela. Quem usar o símbolo isolado
 * — splash, selo — passa um `title`.
 */
export function Mark({
  className,
  title,
}: {
  readonly className?: string;
  readonly title?: string;
}) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={className}
      fill="currentColor"
      role={title === undefined ? "presentation" : "img"}
      aria-hidden={title === undefined}
      aria-label={title}
    >
      <path d={MARK_PATH} />
    </svg>
  );
}

/**
 * A assinatura do produto: símbolo + "LaCalle" + qualificador.
 *
 * É a forma que a pág. 14 obriga dentro de um produto — "a assinatura é sempre
 * símbolo + 'LaCalle' + qualificador, com o qualificador no acento" — e
 * substitui o wordmark solto que o cabeçalho e a sidebar traziam. O símbolo
 * isolado só aparece em splash, favicon e app icon.
 *
 * **Nenhuma medida aqui é arbitrária, e nenhuma é digitada duas vezes.** A pág.
 * 10 define a construção sobre uma unidade `x` igual à altura do símbolo, e as
 * três proporções abaixo são ela, aplicadas por `calc()` a partir de
 * `--signature-h`:
 *
 * - espaço símbolo → texto: **0,5x**
 * - altura de caixa alta do wordmark: **0,62x**
 * - tipografia: **Inter Bold 700, tracking −3%**
 *
 * A altura de caixa alta vira tamanho de fonte dividindo pelo cap height da
 * Inter, que é 1490/2048 = 0,7275 em. Escrever `0.62 / 0.7275` em vez do
 * resultado é o que deixa a conta conferível contra a página.
 *
 * O tamanho vem de um token e não de uma prop porque ele muda com a tela — 18
 * px no celular, 22 no cabeçalho e na sidebar (pág. 14) — e um componente que
 * recebesse número precisaria ser renderizado duas vezes para conseguir isso.
 * A prop existe só para os usos de tamanho fixo que a mesma página lista:
 * login em 32, onboarding em 28, rodapé em 20.
 */
export function Signature({
  height,
  className,
}: {
  readonly height?: number;
  readonly className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap", className)}
      style={{
        ...(height === undefined
          ? {}
          : { "--signature-h": `${String(height)}px` }),
        gap: "calc(var(--signature-h) * 0.5)",
      }}
    >
      <Mark className="h-(--signature-h) w-auto shrink-0 text-ink" />

      {/* `leading-none` para que o centro óptico do texto case com o do
          símbolo: com line-height herdado, a caixa da linha é mais alta que as
          letras e o alinhamento vertical passa a depender do contexto. */}
      <span
        className="font-bold leading-none"
        style={{
          fontSize: "calc(var(--signature-h) * 0.62 / 0.7275)",
          letterSpacing: "-0.03em",
        }}
      >
        {/* "LaCalle" em Ink, o qualificador no acento — pág. 5. Sempre com C
            maiúsculo, que a pág. 10 fixa como parte da assinatura.

            `accent-text` e não `accent`: isto é tipografia, e o verde de
            preenchimento não cumpre os 4,5:1 que a pág. 48 exige de texto. */}
        <span className="text-ink">LaCalle</span>{" "}
        <span className="text-accent-text">Life</span>
      </span>
    </span>
  );
}
