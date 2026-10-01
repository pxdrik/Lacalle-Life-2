import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  hitTargetsAcross,
  setDensity,
  setViewport,
} from "@/test/geometry";

import { EXERCISES_STORE } from "../data/exercise-repository";
import { ExerciseRepositoryProvider } from "../data/exercise-repository-context";
import { LocalExerciseRepository } from "../data/local-exercise-repository";
import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import type { Exercise } from "../types/exercise";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { ExerciseBrowser } from "./exercise-browser";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/exercicios",
}));

/**
 * Roadmap 10.1 e 10.2 (30/09/2026), medidos. A grade de 8 cartões em 4
 * colunas é o pior caso de largura: na Confortável em 320px sobram ~47px por
 * coluna, e o nome tem que caber inteiro ("Ombros", "Pernas", "Cardio"),
 * sem reticências. A folha de filtros, com uma região aberta, não pode rolar
 * para o lado.
 */
function exercise(id: string, name: string, muscle: Exercise["primaryMuscles"][number]): Exercise {
  return {
    id,
    name,
    primaryMuscles: [muscle],
    secondaryMuscles: [],
    stabilizerMuscles: [],
    equipment: ["barbell"],
    movementPattern: "horizontal-push",
    movementPlanes: ["sagittal"],
    technicalDifficulty: "beginner",
    isCompound: true,
    isUnilateral: false,
    aliases: [],
    media: null,
    classification: "catalogue",
    isCustom: false,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

const CATALOGUE = [
  exercise("supino", "Supino Reto com Barra", "chest"),
  exercise("remada", "Remada Curvada", "lats"),
  exercise("desenvolvimento", "Desenvolvimento com Halteres", "front-delts"),
  exercise("rosca", "Rosca Direta", "biceps"),
  exercise("prancha", "Prancha", "abs"),
  exercise("agachamento", "Agachamento Livre", "quads"),
];

function mount() {
  const repository = new LocalExerciseRepository(new MemoryStore<Exercise>(EXERCISES_STORE));
  const ready = Promise.all(CATALOGUE.map((item) => repository.save(item, null)));
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const routines = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));

  render(
    <main className="px-4">
      <WorkoutRepositoryProvider repositories={Promise.resolve({ routines, sessions })}>
        <ExerciseRepositoryProvider repository={ready.then(() => repository)}>
          <ExerciseBrowser persistQuery={false} />
        </ExerciseRepositoryProvider>
      </WorkoutRepositoryProvider>
    </main>,
  );
}

/** A largura natural do texto, com casas decimais, mesmo cortado por reticências. */
function textWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}

function pageOverflow(): number {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth;
}

describe("10.1 e 10.2 — grupos e regiões", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount();

        const grid = await screen.findByRole("group", { name: "Grupos musculares" });
        expect(pageOverflow(), "a página rola de lado").toBeLessThanOrEqual(0);

        const cards = within(grid).getAllByRole("button");
        expect(cards).toHaveLength(8);
        for (const card of cards) {
          const name = card.querySelector("span")!;
          // Nome inteiro: sem reticências, sem passar do cartão.
          // A largura real do texto, com casas decimais, contra a caixa. Nem
          // `scrollWidth` cru nem `overflowX`: os dois são inteiros, e um nome
          // com folga zero (44 de 44) passava enquanto o navegador já desenhava
          // "Ombr…" por uma fração de pixel (print de 320px Confortável).
          expect(textWidth(name), `"${name.textContent ?? ""}" cortado`).toBeLessThanOrEqual(
            name.getBoundingClientRect().width,
          );
          expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(grid.getBoundingClientRect().right + 0.5);
          for (const hit of hitTargetsAcross(card)) {
            expect(card.contains(hit), `toque em ${name.textContent ?? ""}`).toBe(true);
          }
        }

        // A folha de filtros, com Ombros aberto.
        await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
        const muscles = screen.getByRole("group", { name: "Músculo" });
        await userEvent.click(within(muscles).getByRole("button", { name: /^Ombros/ }));
        const sheet = muscles.closest("dialog")!;
        await Promise.all(sheet.getAnimations({ subtree: true }).map((animation) => animation.finished));
        for (const scroller of [sheet, ...sheet.querySelectorAll<HTMLElement>("*")]) {
          const before = scroller.scrollLeft;
          scroller.scrollLeft = 50;
          expect(scroller.scrollLeft, "a folha rola de lado").toBe(before);
          scroller.scrollLeft = before;
        }
        cleanup();
      });
    }
  }
});
