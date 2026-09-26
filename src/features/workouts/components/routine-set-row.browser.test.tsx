import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  centerX,
  overflowX,
  setDensity,
  setViewport,
} from "@/test/geometry";

import type { RoutineExercise } from "../types/routine";
import { RoutineExerciseCard } from "./routine-exercise-card";

/**
 * A mesma medição de `session-set-row.browser.test.tsx`, no editor de rotina.
 *
 * Existe porque a divergência aqui era a maior do projeto e ninguém a
 * media: o cabeçalho reservava `w-16` (64px) para um controle `size-8`
 * (32px) e `w-7` (28px) para um botão de 44px no celular. Trinta e dois e
 * dezesseis pixels de erro duro, sem nenhum `zoom` envolvido.
 *
 * Planejar e executar são telas diferentes com densidades legítimas
 * diferentes, então os números das colunas são outros. O que não pode ser
 * outro é a **mecânica**: uma declaração por card, herdada por cabeçalho e
 * linhas.
 */

const EXERCISE: RoutineExercise = {
  id: "e1",
  exerciseId: "c1",
  name: "Puxada Frontal Pronada",
  restSeconds: 90,
  notes: "",
  sets: [
    { id: "s1", reps: 12, weightKg: 52.6, rpe: 8, durationSeconds: null },
    { id: "s2", reps: 10, weightKg: 60, rpe: 9, durationSeconds: null },
  ],
};

function renderCard() {
  const { container } = render(
    <main className="mx-auto w-full max-w-(--content-max) px-4 md:px-6 lg:px-12">
      <RoutineExerciseCard
        exercise={EXERCISE}
        catalogue={undefined}
        onOpenDetail={vi.fn()}
        position={0}
        total={2}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
        onSwap={vi.fn()}
        onMove={vi.fn()}
        onAddSet={vi.fn()}
        onRemoveSet={vi.fn()}
        onSetChange={vi.fn()}
      />
    </main>,
  );

  const header = container.querySelector<HTMLElement>(".set-grid.uppercase");
  const rows = [...container.querySelectorAll<HTMLElement>("li .set-grid")];

  if (header === null) throw new Error("cabeçalho de colunas não encontrado");
  if (rows.length === 0) throw new Error("nenhuma linha de série encontrada");

  return { header, rows };
}

const COLUMNS = ["série", "peso", "reps", "rpe"];
const TOLERANCE_PX = 1;

beforeEach(async () => {
  await setViewport(390);
});

describe("a linha planejada cabe no card", () => {
  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width);
        setDensity(density);
        const { rows } = renderCard();

        for (const [index, row] of rows.entries()) {
          expect(
            overflowX(row),
            `linha ${String(index + 1)} estourou ${String(overflowX(row))}px`,
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

describe("o cabeçalho fica em cima da coluna que rotula", () => {
  function assertAligned(header: HTMLElement, row: HTMLElement) {
    const headerColumns = [...header.children];
    const rowColumns = [...row.children];

    expect(headerColumns).toHaveLength(rowColumns.length);

    for (const [index, name] of COLUMNS.entries()) {
      const head = headerColumns[index];
      const cell = rowColumns[index];
      if (head === undefined || cell === undefined) continue;

      const delta = centerX(head) - centerX(cell);
      expect.soft(
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

describe("nenhuma coluna é recortada pelo pai", () => {
  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width);
        setDensity(density);
        const { rows } = renderCard();

        for (const row of rows) {
          const clip = row.closest<HTMLElement>(".overflow-hidden");
          if (clip === null) throw new Error("estrutura mudou");
          const box = clip.getBoundingClientRect();

          for (const [index, column] of [...row.children].entries()) {
            const cell = column.getBoundingClientRect();
            expect.soft(
              cell.right,
              `coluna ${String(index)} passa ${(cell.right - box.right).toFixed(1)}px da borda`,
            ).toBeLessThanOrEqual(box.right + 0.5);
            expect.soft(cell.width).toBeGreaterThan(0);
          }
        }
      });
    }
  }
});
