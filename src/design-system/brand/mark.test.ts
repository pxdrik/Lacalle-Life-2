import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ICON_CORNER_RATIO,
  ICON_GRADIENT,
  ICON_SYMBOL_RATIO,
  MARK_HEIGHT,
  MARK_ICON_HEIGHT,
  MARK_ICON_PATH,
  MARK_PATH,
  MARK_WIDTH,
} from "./mark";

/**
 * Um símbolo, uma forma.
 *
 * A pág. 50 do Brand System não deixa margem: "nenhum SVG de logo vive dentro
 * de products/ — todos vêm de brand/logos/". Este app não tem repositório de
 * marca, então a regra vira **um módulo**, e os arquivos que o Next exige em
 * disco (`icon.svg` é uma convenção de arquivo, não pode ser gerada de um
 * import) têm de provar que ainda carregam o mesmo traço.
 *
 * Um comentário dizendo "mantenha em sincronia" já esteve aqui, em outras
 * palavras, e não impediu que o path do iOS fosse uma cópia escrita à mão do
 * path do favicon. Isto impede.
 */

const read = (...path: string[]) =>
  readFileSync(join(process.cwd(), ...path), "utf8");

const FILES = [
  ["the favicon", "src/app/icon.svg"],
  ["the maskable icon", "public/icon-maskable.svg"],
] as const;

describe("the icon files", () => {
  it.each(FILES)("%s draws the module's optically adjusted path", (_, file) => {
    expect(read(file)).toContain(MARK_ICON_PATH);
  });

  it.each(FILES)("%s carries no other path data", (_, file) => {
    // Um segundo `<path>` seria uma segunda forma — e a forma como a marca
    // ganharia um contorno, uma sombra ou um símbolo companheiro sem que nada
    // reclamasse. A pág. 13 proíbe os três.
    expect(read(file).match(/ d="/g)).toHaveLength(1);
  });

  it.each(FILES)("%s frames the symbol at 46% of the canvas", (_, file) => {
    const canvas = 32;
    const scale = (canvas * ICON_SYMBOL_RATIO) / MARK_WIDTH;
    const height = canvas * ICON_SYMBOL_RATIO * (MARK_ICON_HEIGHT / MARK_WIDTH);

    const source = read(file);
    expect(source).toContain(`scale(${String(Number(scale.toFixed(4)))})`);
    // Centrado nos dois eixos: a pág. 15 põe o símbolo no centro do canvas, e
    // uma silhueta que não é quadrada precisa que a conta vertical use a altura
    // dela e não a largura.
    expect(source).toContain(
      `translate(${String(Number(((canvas - canvas * ICON_SYMBOL_RATIO) / 2).toFixed(3)))} ${String(Number(((canvas - height) / 2).toFixed(3)))})`,
    );
  });

  it("rounds the favicon at 22.5% of its side, and the maskable one not at all", () => {
    // Página 15 dá o raio ao ícone do sistema operacional; o maskable sangra,
    // porque o Android aplica a própria máscara e um raio embutido apareceria
    // como um quadrado arredondado flutuando dentro dela.
    expect(read("src/app/icon.svg")).toContain(
      `rx="${String(32 * ICON_CORNER_RATIO)}"`,
    );
    expect(read("public/icon-maskable.svg")).not.toContain("rx=");
  });

  it.each(FILES)("%s fills with the submark gradient, not a flat green", (_, file) => {
    // A única superfície em que o acento pode dominar 100% — pág. 15 — e ela é
    // um gradiente de dois passos vizinhos da escala, nunca uma cor chapada nem
    // três paradas (pág. 46).
    const source = read(file);
    expect(source).toContain(`stop-color="${ICON_GRADIENT.from}"`);
    expect(source).toContain(`stop-color="${ICON_GRADIENT.to}"`);
    expect(source.match(/<stop /g)).toHaveLength(2);
  });
});

describe("the mark itself", () => {
  it("is a single closed contour", () => {
    // Traçada da silhueta do canal alfa, que não tem buracos nem componentes
    // soltos. Um `M` extra significaria um subpath, e `docs/logo-brief.md` põe
    // "reduzir a um path, ou poucos" como restrição de código, não de gosto.
    for (const path of [MARK_PATH, MARK_ICON_PATH]) {
      expect(path.match(/M/g)).toHaveLength(1);
      expect(path.endsWith("Z")).toBe(true);
      // Só cúbicas: uma reta no meio de uma fita contínua seria uma quina, e a
      // pág. 7 descreve a Proposta 01 como "fluida, contínua, evolutiva".
      expect(path).not.toMatch(/[LlHhVvQqTtAaSs]/);
    }
  });

  it("keeps the icon variant the same silhouette, only opened", () => {
    // Página 15: "mesma silhueta, com o vão entre as superfícies alargado".
    // Mesma largura normalizada e altura a menos de 1,5% — se esta divergir, o
    // ajuste óptico deixou de ser óptico e virou outro desenho.
    expect(Math.abs(MARK_ICON_HEIGHT - MARK_HEIGHT) / MARK_HEIGHT).toBeLessThan(
      0.015,
    );
  });
});
