import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  placeholderSlack,
  setDensity,
  setViewport,
} from "@/test/geometry";
import { WorkoutRepositoryProvider } from "@/features/workouts/data/workout-repository-context";
import { LocalRoutineRepository, ROUTINES_STORE } from "@/features/workouts/data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "@/features/workouts/data/session-repository";
import { RoutineList } from "@/features/workouts/components/routine-list";
import type { Routine } from "@/features/workouts/types/routine";
import type { Session } from "@/features/workouts/types/session";

import { DietRepositoryProvider } from "../data/diet-repository-context";
import { DIETS_STORE } from "../data/diet-store";
import { LocalDietRepository } from "../data/local-diet-repository";
import type { Diet } from "../types/diet";
import { DietList } from "./diet-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * Roadmap 8.22 (30/09/2026), protótipo A aprovado pelo Pedro: o "Criar" de
 * Dietas e de Treinos fica só com o "+" no celular. Com o rótulo ele ocupava
 * ~155px em 320px Confortável e o campo mostrava "Nome da no". O teste fica
 * em `diet` e monta as duas listas porque é a mesma linha nas duas telas.
 *
 * A fonte aqui é a de reserva do navegador de teste, não a IBM Plex do app.
 */
function mount() {
  const diets = new LocalDietRepository(new MemoryStore<Diet>(DIETS_STORE));
  const routines = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  render(
    <main className="px-4">
      <DietRepositoryProvider repository={Promise.resolve(diets)}>
        <DietList />
      </DietRepositoryProvider>
      <WorkoutRepositoryProvider repositories={Promise.resolve({ routines, sessions })}>
        <RoutineList />
      </WorkoutRepositoryProvider>
    </main>,
  );
}

describe("8.22 — o nome cabe ao lado do Criar", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount();

        for (const [label, button] of [
          ["Nome da nova dieta", "Criar dieta"],
          ["Nome do novo treino", "Criar treino"],
        ] as const) {
          const field = await screen.findByLabelText<HTMLInputElement>(label);
          expect(placeholderSlack(field), `"${field.placeholder}" cortado`).toBeGreaterThanOrEqual(0);
          const create = within(field.closest("form")!).getByRole("button", { name: button });
          expect(create.getBoundingClientRect().height).toBeCloseTo(field.getBoundingClientRect().height, 0);
        }
        cleanup();
      });
    }
  }
});
