import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  centerX,
  hitTargetsAcross,
  overflowX,
  setDensity,
  setViewport,
} from "@/test/geometry";

import type { SessionExercise } from "../types/session";
import { SessionExerciseCard } from "./session-exercise-card";

/**
 * Roadmap 7.6: a letra do tipo ocupa o lugar do número da série, e a folha
 * de ações ganhou quatro opções com dica. Medido nas larguras e densidades de
 * sempre: a letra centrada na mesma coluna do número, a folha sem rolar para
 * o lado, o nome de cada opção numa linha só, e o toque caindo na opção
 * desenhada.
 */
const EXERCISE: SessionExercise = {
  id: "ex1",
  exerciseId: "cat1",
  name: "Puxada Frontal Pronada",
  restSeconds: 90,
  notes: "",
  sets: [
    { id: "a", reps: 12, weightKg: 30, rpe: null, durationSeconds: null, isCompleted: false, planned: null, kind: "warmup" },
    { id: "b", reps: 12, weightKg: 52.6, rpe: 8, durationSeconds: null, isCompleted: false, planned: null },
  ],
};

function lines(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
}

describe("7.6 — tipo de série", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 800);
        setDensity(density);
        render(
          <main className="mx-auto w-full max-w-(--content-max) px-4 md:px-6 lg:px-12">
            <SessionExerciseCard
              exercise={EXERCISE}
              position={0}
              total={1}
              catalogue={undefined}
              onOpenDetail={vi.fn()}
              nextSetId={null}
              lastTime={undefined}
              onSetChange={vi.fn()}
              onToggleComplete={vi.fn()}
              onRemoveSet={vi.fn()}
              onSetKindChange={vi.fn()}
              onAddSet={vi.fn()}
              onNotesChange={vi.fn()}
              onSwap={vi.fn()}
              onMove={vi.fn()}
            />
          </main>,
        );

        const letter = screen.getByRole("button", {
          name: "Ações da série 1 (Aquecimento) de Puxada Frontal Pronada",
        });
        const number = screen.getByRole("button", { name: "Ações da série 2 de Puxada Frontal Pronada" });
        expect(letter).toHaveTextContent("A");
        // A letra não desloca a coluna: centrada onde o número está.
        expect(Math.abs(centerX(letter) - centerX(number))).toBeLessThanOrEqual(1);

        await userEvent.click(letter);
        const options = ["Normal", "Aquecimento", "Drop set", "Até a falha"].map((label) =>
          screen.getByRole("button", { name: new RegExp(`^${label}`) }),
        );
        const sheet = options[0]!.closest("dialog")!;
        // A folha sobe animada; medir o toque no meio da subida mede a animação.
        await Promise.all(sheet.getAnimations({ subtree: true }).map((animation) => animation.finished));

        expect(overflowX(sheet)).toBeLessThanOrEqual(0);
        for (const option of options) {
          const box = option.getBoundingClientRect();
          expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth + 1);
          // O texto que estoura fica dentro do botão, não na borda da folha.
          expect(overflowX(option), `"${option.textContent ?? ""}" passa da opção`).toBeLessThanOrEqual(0);
          expect(lines(option.querySelector("span > span")!), option.textContent ?? "").toBe(1);
          for (const hit of hitTargetsAcross(option)) {
            expect(option.contains(hit), `toque em ${option.textContent ?? ""}`).toBe(true);
          }
        }
        expect(options[1]).toHaveAttribute("aria-pressed", "true");

        cleanup();
      });
    }
  }
});
