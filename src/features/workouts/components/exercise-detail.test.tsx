import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Exercise } from "../types/exercise";
import { ExerciseDetail } from "./exercise-detail";

/** jsdom has no `matchMedia`; the photo viewer asks it about reduced motion. */
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "supino-reto-barra",
    name: "Supino Reto com Barra",
    aliases: [],
    primaryMuscles: ["chest"],
    secondaryMuscles: [],
    stabilizerMuscles: [],
    equipment: ["barbell"],
    movementPattern: null,
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
    ...overrides,
  };
}

describe("ExerciseDetail", () => {
  it("shows the curation that the list row has no room for", () => {
    render(
      <ExerciseDetail
        exercise={exercise({
          secondaryMuscles: ["triceps", "front-delts"],
          stabilizerMuscles: ["abs"],
          movementPattern: "horizontal-push",
          movementPlanes: ["transverse"],
          technicalDifficulty: "intermediate",
        })}
      />,
    );

    expect(screen.getByText("Também trabalha")).toBeInTheDocument();
    expect(screen.getByText(/Tríceps/)).toBeInTheDocument();
    expect(screen.getByText("Estabilizadores")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Plano")).toBeInTheDocument();
  });

  it("omits a field nobody has decided instead of printing a dash", () => {
    // `null` means undecided in this model. Rendering "Padrão: —" would turn
    // an honest gap into noise on the majority of the catalogue.
    render(<ExerciseDetail exercise={exercise()} />);

    expect(screen.queryByText("Padrão")).not.toBeInTheDocument();
    expect(screen.queryByText("Dificuldade técnica")).not.toBeInTheDocument();
    expect(screen.queryByText("Estabilizadores")).not.toBeInTheDocument();
    expect(screen.queryByText("Outros nomes")).not.toBeInTheDocument();
  });

  it("distinguishes isolated from compound, and says neither when undecided", () => {
    const { rerender } = render(
      <ExerciseDetail exercise={exercise({ isCompound: true })} />,
    );
    expect(screen.getByText(/Composto/)).toBeInTheDocument();

    rerender(<ExerciseDetail exercise={exercise({ isCompound: false })} />);
    expect(screen.getByText(/Isolado/)).toBeInTheDocument();

    rerender(<ExerciseDetail exercise={exercise({ isCompound: null })} />);
    expect(screen.queryByText("Tipo")).not.toBeInTheDocument();
  });

  it("credits the photographer only where a photo is shown", () => {
    const { rerender } = render(<ExerciseDetail exercise={exercise()} />);
    expect(screen.queryByText(/Everkinetic/)).not.toBeInTheDocument();

    rerender(
      <ExerciseDetail
        exercise={exercise({
          media: {
            source: "free-exercise-db",
            images: ["a/0.jpg", "a/1.jpg"],
            credit: null,
          },
        })}
      />,
    );
    expect(screen.getByText(/Everkinetic/)).toBeInTheDocument();
    expect(screen.getByText(/CC BY-SA 4.0/)).toBeInTheDocument();
  });

  it("says an exercise is the user's own, since the catalogue will not touch it", () => {
    render(<ExerciseDetail exercise={exercise({ isCustom: true })} />);

    expect(screen.getByText(/criado por você/)).toBeInTheDocument();
  });
});
