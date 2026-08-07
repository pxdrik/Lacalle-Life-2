import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Exercise } from "../types/exercise";
import { ExerciseIdentity } from "./exercise-identity";

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
    media: { source: "free-exercise-db", images: ["a/0.jpg", "a/1.jpg"] },
    classification: "catalogue",
    isCustom: false,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("ExerciseIdentity", () => {
  it("shows the name the workout stored, not the catalogue's", () => {
    // The routine copies the name on purpose, so renaming an exercise never
    // rewrites what was lifted months ago. The photo still comes from the
    // catalogue, because that follows the live `exerciseId`.
    render(
      <ExerciseIdentity
        name="Supino (como eu chamava)"
        catalogue={exercise({ name: "Supino Reto com Barra" })}
        onOpenDetail={() => undefined}
      >
        3 séries
      </ExerciseIdentity>,
    );

    expect(screen.getByText("Supino (como eu chamava)")).toBeInTheDocument();
    expect(screen.queryByText("Supino Reto com Barra")).not.toBeInTheDocument();
    // Queried as an element, not by role: the thumbnail is `alt=""` on
    // purpose, because the name sits right beside it and a screen reader
    // announcing both would say the same thing twice.
    expect(document.querySelector("img")).not.toBeNull();
  });

  it("opens the detail with the catalogue entry behind the id", async () => {
    const onOpenDetail = vi.fn();
    const entry = exercise();
    const user = userEvent.setup();

    render(
      <ExerciseIdentity
        name="Supino Reto com Barra"
        catalogue={entry}
        onOpenDetail={onOpenDetail}
      >
        3 séries
      </ExerciseIdentity>,
    );

    await user.click(
      screen.getByRole("button", { name: /Ver detalhes de Supino/ }),
    );

    expect(onOpenDetail).toHaveBeenCalledWith(entry);
  });

  it("stays a plain label when the exercise cannot be resolved", () => {
    // Catalogue still loading, or the exercise was deleted. The workout has to
    // keep working; it just cannot offer a photo or a detail to open.
    render(
      <ExerciseIdentity
        name="Exercício apagado"
        catalogue={undefined}
        onOpenDetail={() => undefined}
      >
        3 séries
      </ExerciseIdentity>,
    );

    expect(screen.getByText("Exercício apagado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("omits the subtitle line entirely when there is nothing to say", () => {
    const { container } = render(
      <ExerciseIdentity
        name="Supino Reto com Barra"
        catalogue={exercise()}
        onOpenDetail={() => undefined}
      >
        {null}
      </ExerciseIdentity>,
    );

    expect(container.querySelectorAll("span.text-xs")).toHaveLength(0);
  });
});
