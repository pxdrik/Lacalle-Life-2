import { describe, expect, it } from "vitest";

import { mountHtml } from "@/test/geometry";

/**
 * Contraste medido no navegador, a partir das cores que o CSS realmente
 * resolve — não das strings de `tokens.css`.
 *
 * `tokens.test.ts` já confere os valores declarados, e é a régua certa para
 * "o token é o que o brandbook diz". Esta é a outra pergunta: **o que chega à
 * tela**, depois de `@theme`, do tema ativo e de qualquer utilitário por
 * cima. Um token correto aplicado à camada errada mede errado aqui e passa lá.
 *
 * Foi assim que o achado D1 virou número: as marcas do RPE usavam um token
 * legítimo (`canvas`) contra a superfície errada (`muted`).
 */

function srgb(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const parts = color.match(/\d+(\.\d+)?/g);
  if (parts === null) throw new Error(`cor ilegível: ${color}`);
  const [r, g, b] = parts.map(Number) as [number, number, number];

  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

/** A razão de contraste WCAG entre duas cores já resolvidas. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return Math.round(((light! + 0.05) / (dark! + 0.05)) * 100) / 100;
}

/** A cor que um utilitário do Tailwind resolve no tema ativo. */
function resolve(
  utility: string,
  property: "color" | "backgroundColor" | "borderColor",
): string {
  const { root, remove } = mountHtml(
    `<span class="${utility}" style="border-style:solid">x</span>`,
  );
  const value = getComputedStyle(root.firstElementChild!)[property];
  remove();

  return value;
}

const THEMES = ["light", "dark"] as const;

describe.each(THEMES)("UI-06 — superfícies no tema %s", (theme) => {
  function setTheme() {
    document.documentElement.setAttribute("data-theme", theme);
  }

  /**
   * O achado D3, fixado como número em vez de como impressão.
   *
   * No claro, `canvas` (#F8FAFC) contra `surface` (#FFFFFF) são 1,05:1 — um
   * card se separa da página quase só pela borda de 1px. Os dois valores são
   * normativos no brandbook ("fundo da aplicação sempre Background; card
   * sempre White"), e a pág. 24 proíbe recuperar a hierarquia com sombra.
   *
   * Este teste **não exige** um valor melhor: exige que ninguém mude isso sem
   * perceber. Se a separação for revista (decisão de marca, não técnica), é
   * aqui que a revisão aparece.
   */
  it("registra a separação entre canvas e superfície de card", () => {
    setTheme();
    const canvas = resolve("bg-canvas", "backgroundColor");
    const surface = resolve("bg-surface", "backgroundColor");
    const line = resolve("border-line", "borderColor");

    const ratio = contrastRatio(canvas, surface);
    const edge = contrastRatio(line, surface);

    expect(ratio).toBeGreaterThanOrEqual(1);
    // A borda é o que realmente desenha o card hoje. Se ela deixar de
    // contrastar com a superfície, o card some nos dois temas.
    expect(edge).toBeGreaterThan(ratio);
  });

  it("mantém o texto de corpo legível sobre a superfície do card", () => {
    setTheme();
    const surface = resolve("bg-surface", "backgroundColor");

    expect(contrastRatio(resolve("text-ink", "color"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(resolve("text-ink-muted", "color"), surface),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
