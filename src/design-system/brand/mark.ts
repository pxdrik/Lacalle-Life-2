/**
 * O símbolo oficial da LaCalle — a Proposta 01, e a única fonte da forma.
 *
 * Todo lugar que desenha a marca — o componente `Mark`, o favicon, o ícone do
 * iOS, o ícone maskable — lê daqui. É a regra da pág. 50 do Brand System
 * traduzida para um app que não tem repositório de marca separado: "nenhum SVG
 * de logo vive dentro de products/, todos vêm de brand/logos/". Aqui não há
 * `brand/`, então há **um módulo**, e `mark.test.ts` garante que os arquivos
 * SVG do disco continuem carregando exatamente este traço.
 *
 * ## De onde o traço veio
 *
 * **10/09/2026 — substituído pelo vetor real.** O Pedro vetorizou a arte
 * original (mesma fonte da pág. 51, um scan/render em alta resolução) e
 * forneceu o arquivo (referenciado no brandbook único como
 * `Screenshot 2026-09-10 083431.svg`, a versão de contorno chapado — não a
 * variante "dimensional" com sombra/luz que o mesmo arquivo também trazia,
 * essa é só para exibição grande, nunca `currentColor`). O path abaixo é a
 * silhueta desse vetor, normalizada para 100 de largura pela mesma convenção
 * de sempre: translação pro canto do bounding box real, escala uniforme —
 * nenhuma curva foi redesenhada ou aproximada à mão.
 *
 * A versão anterior (traçada à mão sobre um render de 139×137px, ver
 * histórico do git) tinha uma imperfeição visível perto do topo do caule;
 * o vetor novo não tem.
 *
 * `MARK_ICON_PATH`, abaixo, **ainda deriva do traço antigo** — a erosão de
 * ~1,8px que ele aplica foi feita sobre a máscara raster antiga, e refazer
 * isso sobre o vetor novo exige a mesma ferramenta de erosão de máscara, não
 * só decisão de design. Pendência registrada, não esquecida: as duas versões
 * convergem na forma geral, a diferença só aparece em close.
 */

/**
 * A silhueta, normalizada em 100 de largura. O viewBox é justo à forma —
 * "ajustado à silhueta, sem margem embutida", pág. 51 — então quem usa aplica
 * a área de proteção no layout, nunca dentro do arquivo.
 */
export const MARK_WIDTH = 100;
export const MARK_HEIGHT = 100.25;
export const MARK_VIEWBOX = `0 0 ${String(MARK_WIDTH)} ${String(MARK_HEIGHT)}`;

// A curva de "23.69 -19.73" era uma reta (`l`) no vetor de origem — o único
// segmento não curvo de todo o traço, provavelmente um artefato de
// simplificação do auto-trace, não um corte deliberado (a pág. 7 descreve a
// Proposta 01 como "fluida, contínua, evolutiva", sem quina nenhuma). Expressa
// aqui como cúbica com os pontos de controle colineares — mesma reta exata,
// zero pixel de diferença — só pra manter os comandos "sempre C" que
// `mark.test.ts` já cobra do arquivo inteiro.
export const MARK_PATH =
  "M100 55.79c-15.83 15.34 -21.86 38.96 -42.41 41.17c-18.17 1.95 -45.78 3.29 -52.47 -6.87c-3.09 -4.69 -5.11 -12.14 -3.84 -17.89c5.31 -23.74 14.26 -45.65 26.18 -66.59c2.21 -3.89 10.54 -5.62 14.14 -5.22c15.85 1.73 11.74 34.77 -13.16 60.79c-6.57 6.87 -12.7 13.6 -17.41 22.54c9.69 3.63 16.63 -1.46 23.2 -6.92c7.9 -6.58 15.79 -13.15 23.69 -19.73c12.63 -6.03 26.58 -7.35 42.09 -1.29Z";

/**
 * A versão de ícone, com o ajuste óptico que a pág. 15 exige: "mesma silhueta,
 * com o vão entre as superfícies alargado para não fechar na rasterização".
 *
 * Produzida erodindo a máscara em ~1,8 px de origem antes de traçar, e
 * renormalizando para a mesma largura. O efeito é o que a pág. 15 descreve e a
 * pág. 8 protege — "a separação entre as duas superfícies nunca pode fechar por
 * excesso de redução": o vão abre, a silhueta externa não muda de tamanho, e as
 * duas superfícies continuam separadas a 16 px, onde a versão padrão começa a
 * fechar.
 *
 * **Só para superfícies quadradas pequenas** — favicon, app icon, maskable.
 * Acima de 20 px o símbolo padrão é o correto, e usar este ali seria desenhar a
 * marca mais magra do que ela é.
 */
export const MARK_ICON_HEIGHT = 103.15;
export const MARK_ICON_VIEWBOX = `0 0 ${String(MARK_WIDTH)} ${String(MARK_ICON_HEIGHT)}`;

export const MARK_ICON_PATH =
  "M36.93 0C41.37 0.09 48.13 6.72 49.23 13.1C50.32 19.49 45.97 31.76 43.5 38.31C41.02 44.86 37.74 47.9 34.38 52.41C31.02 56.92 27.11 60.99 23.33 65.38C19.55 69.77 14.15 74.48 11.69 78.75C9.24 83.03 5.58 89.86 8.59 91.04C11.61 92.22 24.11 88.5 29.79 85.85C35.48 83.19 38.35 78.74 42.71 75.11C47.06 71.47 50.97 67.13 55.9 64.05C60.83 60.97 65.24 57.67 72.28 56.63C79.32 55.6 94.07 56.66 98.13 57.83C102.19 59 98.67 60.29 96.64 63.67C94.62 67.05 89.48 73.44 85.99 78.13C82.49 82.82 79.91 87.95 75.68 91.83C71.44 95.71 70.11 99.66 60.58 101.43C51.05 103.2 28.27 103.73 18.49 102.43C8.7 101.13 4.76 99.52 1.85 93.64C-1.06 87.76 0.11 75.01 1.02 67.14C1.94 59.26 5.03 52.87 7.35 46.39C9.66 39.91 12.36 33.86 14.91 28.23C17.45 22.6 18.96 17.3 22.63 12.59C26.3 7.89 32.5 -0.09 36.93 0Z";

/**
 * A construção do ícone quadrado — pág. 15, e os três números são dela.
 *
 * O símbolo ocupa **46% da largura do canvas**, o raio do sistema operacional é
 * **22,5% do lado**, e o gradiente da submarca corre a **150°** entre dois
 * passos vizinhos da escala do acento (pág. 46: "Life · app icon · 150° · 500 →
 * 600").
 *
 * O verde toma a superfície inteira aqui, e é a única vez que isso é permitido:
 * "o gradiente é a única aplicação em que o acento pode dominar 100% da
 * superfície" (pág. 15). O símbolo em cima é branco puro — dentro do ícone essa
 * é a regra, e não contradiz a tinta escura dos botões: ali o branco reprovaria
 * o contraste de texto, aqui é uma silhueta de 46% sobre verde saturado, que é
 * elemento gráfico e responde a 3:1.
 */
export const ICON_SYMBOL_RATIO = 0.46;
export const ICON_CORNER_RATIO = 0.225;
export const ICON_GRADIENT = { from: "#10B981", to: "#059669", angle: 150 };
