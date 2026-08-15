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
 * O vetor oficial da pág. 51 **não existe** — o Brand System descreve o pacote
 * de logo como "especificação a produzir". O que existe é a arte rasterizada
 * dentro do PDF, e o maior render dela em qualquer um dos dois brandbooks mede
 * **139 × 137 px**. Este path foi traçado dali: canal alfa da arte, contorno
 * seguido em resolução 6×, reamostrado por comprimento de arco e ajustado em
 * bézier cúbicas com âncoras distribuídas por curvatura. A divergência de área
 * contra o original é de 6,6%, quase toda ela a franja de antialias de 1 px.
 *
 * **`docs/logo-brief.md` dizia que traçar "ficaria pior que o original", e essa
 * nota estava certa sobre outra coisa.** Ela foi escrita olhando a fita em
 * degradê — uma peça renderizada em 3D, cuja leitura vem inteira do sombreado.
 * Adivinhar aquilo curva por curva de fato produziria algo pior. Mas a versão
 * que o brandbook pede na pág. 8 é outra: "em monocromia, usar a versão de
 * contorno preenchido". Essa é a silhueta do canal alfa, que é **um contorno
 * fechado, sem buracos e sem cantos** — e uma curva ajustada à mão em cima dela
 * fica melhor que os 139 px de origem, não pior.
 *
 * Quando o vetor oficial aparecer, ele substitui as duas constantes abaixo e
 * nada mais precisa mudar.
 */

/**
 * A silhueta, normalizada em 100 de largura. O viewBox é justo à forma —
 * "ajustado à silhueta, sem margem embutida", pág. 51 — então quem usa aplica
 * a área de proteção no layout, nunca dentro do arquivo.
 */
export const MARK_WIDTH = 100;
export const MARK_HEIGHT = 102.04;
export const MARK_VIEWBOX = `0 0 ${String(MARK_WIDTH)} ${String(MARK_HEIGHT)}`;

export const MARK_PATH =
  "M36.01 0C40.71 -0.07 48.87 5.34 50.38 11.82C51.89 18.3 47.33 32.11 45.07 38.86C42.8 45.6 39.96 47.93 36.78 52.29C33.6 56.64 29.67 60.8 25.99 64.97C22.32 69.14 17.15 73.5 14.72 77.3C12.29 81.11 8.83 87.04 11.4 87.82C13.96 88.59 24.93 84.68 30.11 81.96C35.29 79.25 38.27 75.01 42.48 71.52C46.69 68.04 50.17 63.91 55.36 61.04C60.56 58.17 66.46 55.07 73.64 54.3C80.81 53.53 94.64 54.87 98.41 56.42C102.19 57.98 98.3 60.21 96.3 63.65C94.29 67.09 89.79 72.52 86.39 77.08C82.99 81.64 80.08 87.13 75.91 91.01C71.73 94.88 70.71 98.58 61.34 100.31C51.96 102.04 29.5 102.62 19.64 101.38C9.79 100.14 5.32 98.79 2.18 92.86C-0.96 86.93 -0.03 73.76 0.82 65.79C1.67 57.83 5 51.35 7.27 45.08C9.54 38.81 11.97 33.64 14.45 28.16C16.93 22.68 18.58 16.91 22.17 12.22C25.76 7.53 31.3 0.07 36.01 0Z";

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
