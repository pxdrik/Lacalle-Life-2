import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Exercise } from "../types/exercise";
import { ExerciseRow } from "./exercise-row";

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

/**
 * The name used to be a single `truncate` line, unreadable once the
 * thumbnail and the star/add buttons took their share of a phone-width row.
 */
describe("the exercise name", () => {
  it("is not clipped to a single truncated line", () => {
    const longName =
      "Elevação Lateral com Halteres Sentado no Banco Inclinado";
    render(
      <ul>
        <ExerciseRow
          exercise={exercise({ name: longName })}
          onToggleFavorite={vi.fn()}
          onOpenDetail={vi.fn()}
        />
      </ul>,
    );

    const nameSpan = screen.getByText(longName);
    expect(nameSpan.className).not.toContain("truncate");
  });

  it("keeps the whole row as one clickable control that opens the detail view", async () => {
    const longName = "Elevação Lateral com Halteres Sentado no Banco";
    const onOpenDetail = vi.fn();
    render(
      <ul>
        <ExerciseRow
          exercise={exercise({ name: longName })}
          onToggleFavorite={vi.fn()}
          onOpenDetail={onOpenDetail}
        />
      </ul>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: `Ver detalhes de ${longName}` }),
    );

    expect(onOpenDetail).toHaveBeenCalledOnce();
  });

  it("still gives the add button a full 44px hit area alongside a wrapped name", () => {
    render(
      <ul>
        <ExerciseRow
          exercise={exercise()}
          onToggleFavorite={vi.fn()}
          onOpenDetail={vi.fn()}
          onSelect={vi.fn()}
        />
      </ul>,
    );

    expect(
      screen.getByRole("button", { name: "Adicionar Supino Reto com Barra" }),
    ).toHaveClass("touch-44");
  });
});
