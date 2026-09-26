import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  overflowX,
  centerX,
  hitTargetsAcross,
  setDensity,
  setViewport,
  type Density,
} from "@/test/geometry";

import type { Exercise } from "../types/exercise";
import type { SessionExercise } from "../types/session";
import { SessionExerciseCard } from "./session-exercise-card";

/**
 * A geometria da linha de série, medida num navegador de verdade.
 *
 * TRAINING-020/021/022 da matriz de regressão. Cada asserção aqui nasceu de
 * um defeito medido em 25/09/2026, não de uma preocupação teórica:
 *
 * - a linha estourava o card em 360px na densidade Padrão (21px) e em 390px
 *   na Confortável (22px), e o pai é `overflow-hidden` por exigência do
 *   `useCollapsibleRemove`, então o que estoura é **recortado**: o X de
 *   remover a série simplesmente sumia;
 * - o cabeçalho e a linha são duas listas de largura escritas à mão, e já
 *   divergiam (o cabeçalho reserva `w-14` para o RPE, o controle é
 *   `size-11`), com o desvio chegando a 27px na Confortável.
 *
 * Nada disso é visível em jsdom, que não calcula layout.
 */

const EXERCISE: SessionExercise = {
  id: "ex1",
  exerciseId: "cat1",
  name: "Puxada Frontal Pronada",
  restSeconds: 90,
  notes: "",
  sets: [
    {
      id: "set1",
      reps: 12,
      weightKg: 52.6,
      rpe: 8,
      durationSeconds: null,
      isCompleted: false,
      planned: { reps: 12, weightKg: 52.6, rpe: 8, durationSeconds: null },
    },
    {
      id: "set2",
      reps: null,
      weightKg: null,
      rpe: null,
      durationSeconds: null,
      isCompleted: false,
      planned: { reps: 12, weightKg: 52.6, rpe: 8, durationSeconds: null },
    },
  ],
};

/**
 * O card dentro do mesmo envelope que o app lhe dá: `PageShell` tem `px-4`
 * no celular, e é essa a largura que sobra de verdade. Medir o card colado
 * na borda da janela mediria um card que ninguém vê.
 */
/** Só o que o card lê: `movementPattern` decide cardio contra força. */
const CARDIO_ENTRY = {
  id: "cat1",
  name: "Esteira",
  aliases: [],
  primaryMuscles: [],
  secondaryMuscles: [],
  stabilizerMuscles: [],
  equipment: [],
  movementPattern: "cardio",
  movementPlanes: [],
  technicalDifficulty: null,
  isUnilateral: null,
  isCompound: null,
  media: null,
  classification: "catalogue",
  isCustom: false,
  isFavorite: false,
  createdAt: 1,
  updatedAt: 1,
} as unknown as Exercise;

function renderCard(
  exercise: SessionExercise = EXERCISE,
  catalogue: Exercise | undefined = undefined,
) {
  const { container } = render(
    <main className="mx-auto w-full max-w-(--content-max) px-4 md:px-6 lg:px-12">
      <SessionExerciseCard
        exercise={exercise}
        position={0}
        total={2}
        catalogue={catalogue}
        onOpenDetail={vi.fn()}
        nextSetId={null}
        lastTime={undefined}
        onSetChange={vi.fn()}
        onToggleComplete={vi.fn()}
        onRemoveSet={vi.fn()}
        onAddSet={vi.fn()}
        onNotesChange={vi.fn()}
        onSwap={vi.fn()}
        onMove={vi.fn()}
      />
    </main>,
  );

  // Cabeçalho e linhas são o **mesmo** `.set-grid`, que é exatamente a
  // propriedade sob teste. O cabeçalho é `aria-hidden` e nenhuma consulta por
  // papel o alcança; `uppercase` é a classe que só ele tem dentro do card.
  const header = container.querySelector<HTMLElement>(".set-grid.uppercase");
  const rows = [
    ...container.querySelectorAll<HTMLElement>("li .set-grid"),
  ];

  if (header === null) throw new Error("cabeçalho de colunas não encontrado");
  if (rows.length === 0) throw new Error("nenhuma linha de série encontrada");

  return { container, header, rows };
}

/** Os nomes das colunas, na ordem em que a grade as declara. */
const COLUMNS = ["série", "peso", "reps", "rpe", "concluir"];

beforeEach(async () => {
  await setViewport(390);
});

describe("TRAINING-020 — a linha de série cabe no card", () => {
  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width);
        setDensity(density);
        const { rows } = renderCard();

        for (const [index, row] of rows.entries()) {
          expect(
            overflowX(row),
            `linha ${String(index + 1)} estourou ${String(overflowX(row))}px, e o pai recorta`,
          ).toBeLessThanOrEqual(0);
        }
      });
    }
  }

  it(`${String(DESKTOP_WIDTH)}px, desktop`, async () => {
    await setViewport(DESKTOP_WIDTH);
    const { rows } = renderCard();

    for (const row of rows) expect(overflowX(row)).toBeLessThanOrEqual(0);
  });
});

describe("TRAINING-021/022 — o cabeçalho fica em cima da coluna que rotula", () => {
  /**
   * Um pixel de tolerância, não zero: meio pixel de arredondamento de
   * subpixel é ruído do navegador, e 12px é um cabeçalho apontando para a
   * coluna errada. A folga existe para o ruído, não para a divergência.
   */
  const TOLERANCE_PX = 1;

  function assertAligned(header: HTMLElement, row: HTMLElement) {
    const headerColumns = [...header.children];
    const rowColumns = [...row.children];

    expect(headerColumns).toHaveLength(rowColumns.length);

    for (const [index, name] of COLUMNS.entries()) {
      const head = headerColumns[index];
      const cell = rowColumns[index];
      if (head === undefined || cell === undefined) continue;

      const delta = centerX(head) - centerX(cell);
      expect(
        Math.abs(delta),
        `coluna "${name}" desalinhada em ${delta.toFixed(1)}px`,
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    }
  }

  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width);
        setDensity(density);
        const { header, rows } = renderCard();

        for (const row of rows) assertAligned(header, row);
      });
    }
  }

  it(`${String(DESKTOP_WIDTH)}px, desktop`, async () => {
    await setViewport(DESKTOP_WIDTH);
    const { header, rows } = renderCard();

    for (const row of rows) assertAligned(header, row);
  });
});

describe("cardio tem outra grade, e ela também tem que fechar", () => {
  /**
   * Exercício medido por tempo troca peso/reps/RPE por uma coluna de duração
   * — três faixas em vez de cinco, declaradas no mesmo `--set-cols`. É um
   * caminho de renderização inteiro do componente que a grade mudou, e sem
   * isto ficaria sem nenhuma medição.
   */
  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width);
        setDensity(density);
        const { header, rows } = renderCard(EXERCISE, CARDIO_ENTRY);

        for (const row of rows) {
          expect(overflowX(row)).toBeLessThanOrEqual(0);
          expect([...row.children]).toHaveLength(header.children.length);

          for (const [index, column] of [...row.children].entries()) {
            const head = header.children[index];
            if (head === undefined) continue;
            expect
              .soft(
                Math.abs(centerX(head) - centerX(column)),
                `coluna ${String(index)} desalinhada`,
              )
              .toBeLessThanOrEqual(1);
          }
        }
      });
    }
  }
});

describe("TRAINING-023/024 — cada controle recebe o próprio toque", () => {
  /**
   * A grade aproximou os controles, e `touch-44` estende alvo **fora do
   * layout**: o gatilho das ações desenha 24px de coluna e tem 44px de alvo,
   * então ele transborda 10px para cada lado e encosta no campo de peso.
   * Encostar não é problema; roubar é. Esta é a mesma classe do defeito
   * medido na barra de ações do exercício, onde os ~19% da direita de cada
   * ícone disparavam o vizinho.
   */
  for (const density of DENSITIES) {
    it(`390px, densidade ${density}`, async () => {
      await setViewport(390);
      setDensity(density);
      const { rows } = renderCard();
      const row = rows[0];
      if (row === undefined) throw new Error("sem linha");

      // `dialog:not([open])` fica no DOM com os próprios botões dentro. Eles
      // não estão na tela, então `elementFromPoint` nunca os devolve e medi-los
      // seria medir o nada.
      const controls = [...row.querySelectorAll("button, input")].filter(
        (element) => element.closest("dialog:not([open])") === null,
      );

      for (const control of controls) {
        for (const [index, hit] of hitTargetsAcross(control).entries()) {
          expect
            .soft(
              hit === control || control.contains(hit),
              `parada ${String(index)} de "${control.getAttribute("aria-label") ?? control.tagName}" foi para outro elemento`,
            )
            .toBe(true);
        }
      }
    });
  }
});

describe("nenhuma coluna é recortada, e remover a série continua alcançável", () => {
  /**
   * Renderizado e alcançável são coisas diferentes, e esta é a diferença que
   * o jsdom não vê: o elemento existe na árvore, tem rótulo acessível, e está
   * fora da parte visível do pai que o recorta.
   *
   * O alvo mudou em 26/09/2026 junto com a grade. Antes era o X de remover,
   * que era a última coluna e por isso a primeira a ser cortada; ele saiu da
   * linha porque seis alvos da classe 44px não cabem em 360px. A asserção
   * ficou mais forte, não mais fraca: agora **nenhuma** coluna pode passar da
   * borda, e o gatilho das ações da série (que é onde remover foi parar)
   * também é verificado.
   */
  function assertInsideClip(row: HTMLElement) {
    const clip = row.closest<HTMLElement>(".overflow-hidden");
    if (clip === null) throw new Error("estrutura mudou");
    const box = clip.getBoundingClientRect();

    for (const [index, column] of [...row.children].entries()) {
      const cell = column.getBoundingClientRect();
      expect(
        cell.right,
        `coluna ${String(index)} passa ${(cell.right - box.right).toFixed(1)}px da borda que recorta`,
      ).toBeLessThanOrEqual(box.right + 0.5);
      expect(cell.width).toBeGreaterThan(0);
    }
  }

  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width);
        setDensity(density as Density);
        const { rows } = renderCard();

        for (const row of rows) assertInsideClip(row);
      });
    }
  }
});
