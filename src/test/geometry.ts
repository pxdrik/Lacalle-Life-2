import { page } from "vitest/browser";

/**
 * As medidas que os testes de navegador fazem, num lugar só.
 *
 * Tudo aqui devolve **número**, nunca "parece certo". A auditoria de
 * 25/09/2026 começou porque uma tela quebrada passava por 1936 testes
 * verdes: o que faltava não era rigor, era régua. Estas são as réguas.
 */

/** Os três patamares de `data-density` (ver `tokens.css`). */
export const DENSITIES = ["compact", "default", "comfortable"] as const;
export type Density = (typeof DENSITIES)[number];

/**
 * As larguras que importam, e por que cada uma está aqui.
 *
 * 320: o menor telefone que ainda aparece, e o pior caso real.
 * 360: linha Galaxy S e Pixel, a largura mais comum do Android.
 * 375: iPhone SE / mini.
 * 390: iPhone 12 a 16 base, o aparelho do Pedro.
 * 414: iPhone Plus / Max.
 * 1280: desktop.
 */
export const PHONE_WIDTHS = [320, 360, 375, 390, 414] as const;
export const DESKTOP_WIDTH = 1280;

export async function setViewport(width: number, height = 800): Promise<void> {
  await page.viewport(width, height);
}

/**
 * `default` é a ausência do atributo, não um valor. Declarar
 * `data-density="default"` cairia numa regra que `tokens.css` de propósito
 * não escreve, e o teste mediria um estado que o app nunca tem.
 */
export function setDensity(density: Density): void {
  if (density === "default") {
    document.documentElement.removeAttribute("data-density");
    return;
  }
  document.documentElement.setAttribute("data-density", density);
}

/**
 * Quanto o conteúdo passa da caixa que deveria contê-lo, em pixels.
 *
 * Zero ou menos é o único resultado aceitável numa linha que não pode
 * quebrar. Positivo significa que alguma coisa está fora da vista, e num
 * pai com `overflow: hidden` significa que está **recortada** — foi assim
 * que o X de remover série sumia em 360px.
 */
export function overflowX(element: Element): number {
  return element.scrollWidth - element.clientWidth;
}

/** O centro horizontal de um elemento, em pixels da viewport. */
export function centerX(element: Element): number {
  const box = element.getBoundingClientRect();
  return (box.left + box.right) / 2;
}

/**
 * O botão (ou elemento) que o ponteiro **de fato** atinge numa fração da
 * largura visível de `element`.
 *
 * `0` é a borda esquerda e `1` a direita; as bordas são puxadas para dentro
 * um pixel porque a borda exata pertence ao vizinho por definição, não por
 * defeito. Existe porque área visual e área de toque são coisas diferentes:
 * `touch-44` (`globals.css`) estende o alvo para 44px **fora do layout**, e
 * em botões vizinhos sem intervalo suficiente os alvos se empilham e vence o
 * último do DOM.
 */
export function hitTargetAt(element: Element, fraction: number): Element | null {
  const box = element.getBoundingClientRect();
  const inset = Math.min(1, box.width / 4);
  const x = box.left + inset + (box.width - inset * 2) * fraction;
  const y = box.top + box.height / 2;

  return document.elementFromPoint(x, y);
}

/**
 * Percorre a largura visível de `element` e devolve quem recebe o toque em
 * cada parada. Um controle correto devolve ele mesmo em todas.
 */
export function hitTargetsAcross(
  element: Element,
  stops = [0, 0.25, 0.5, 0.75, 1],
): readonly (Element | null)[] {
  return stops.map((fraction) => hitTargetAt(element, fraction));
}

/**
 * Monta um nó solto no documento e devolve uma função para removê-lo.
 *
 * Para medir marcação que não é um componente React inteiro — um cabeçalho
 * de coluna contra a linha que ele rotula, por exemplo.
 */
export function mountHtml(html: string): {
  readonly root: HTMLElement;
  readonly remove: () => void;
} {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);

  return {
    root,
    remove: () => {
      root.remove();
    },
  };
}
