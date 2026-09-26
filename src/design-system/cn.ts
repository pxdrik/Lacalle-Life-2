import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Os nomes da escala tipográfica da marca, como `tokens.css` os declara.
 *
 * Repetidos aqui de propósito, e é a única duplicação aceitável: o
 * `tailwind-merge` resolve conflitos lendo **o nome da classe**, antes de
 * qualquer CSS existir, então ele não tem como descobrir sozinho o que o
 * `@theme` definiu. Se um passo entrar ou sair de `tokens.css`, entra ou sai
 * daqui junto — e o teste de `tokens.test.ts` compara as duas listas para
 * que esquecer disso seja vermelho, não silencioso.
 */
const BRAND_FONT_SIZES = [
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "label",
  "metric",
] as const;

/**
 * O `twMerge` precisa saber que `text-metric` é um tamanho, não uma cor.
 *
 * **Achado real, Sprint 1, 26/09/2026.** `cn("text-metric …", "text-ink")`
 * devolvia `"font-semibold tabular-nums text-ink"` — com o `text-metric`
 * **removido**. O `tailwind-merge` classifica `text-<algo>` desconhecido como
 * cor, e duas cores no mesmo `cn()` são um conflito onde a última vence. O
 * herói de `/hoje` ficava com 16px herdados enquanto a classe certa estava
 * escrita no componente, e nenhum teste de unidade veria isso: a asserção
 * natural ("a classe está lá") conferiria a string que o componente escreve,
 * não a que o DOM recebe.
 *
 * É também metade da explicação para a escala da marca ter 5 usos contra 340
 * da escala do Tailwind (auditoria, D2): ela só funcionava onde o
 * `className` era uma string literal sem cor junto — a Landing — e
 * desaparecia em silêncio em qualquer componente que use `cn`, que é a
 * regra da casa.
 *
 * Por isso a correção é aqui e não no componente. Reordenar as classes ou
 * largar o `cn` naquele `<p>` resolveria aquele `<p>`; isto resolve todos os
 * que ainda não foram escritos.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...BRAND_FONT_SIZES] }] } },
});

/**
 * Joins class names and resolves Tailwind conflicts, so that a `className`
 * passed by a caller reliably wins over a component's own default rather than
 * depending on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Exportado só para `tokens.test.ts`, que confere contra `tokens.css`. */
export { BRAND_FONT_SIZES };
