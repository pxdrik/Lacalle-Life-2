import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Exercise } from "../types/exercise";
import { ExercisePhotos } from "./exercise-photos";

function stubMotionPreference(reduced: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function exercise(images: string[]): Exercise {
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
    media:
      images.length === 0
        ? null
        : { source: "free-exercise-db", images, credit: null },
    classification: "catalogue",
    isCustom: false,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("ExercisePhotos", () => {
  it("says the photo is absent instead of leaving a gap", () => {
    // This used to render nothing, which collapsed the detail view's photo
    // column and left a wide blank beside the metadata. An audit read that
    // blank as a broken image — reasonably, since nothing on screen said the
    // catalogue simply has no photograph for 25 of its exercises.
    stubMotionPreference(false);
    render(<ExercisePhotos exercise={exercise([])} />);

    expect(
      screen.getByText("Sem foto para este exercício."),
    ).toBeInTheDocument();
  });

  it("offers no play control with nothing to animate", () => {
    stubMotionPreference(false);
    render(<ExercisePhotos exercise={exercise([])} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers both positions when the source gives two frames", () => {
    stubMotionPreference(false);
    render(<ExercisePhotos exercise={exercise(["a/0.jpg", "a/1.jpg"])} />);

    expect(screen.getByRole("button", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fim" })).toBeInTheDocument();
  });

  it("hides the controls for a single frame, which has nothing to alternate", () => {
    stubMotionPreference(false);
    render(<ExercisePhotos exercise={exercise(["a/0.jpg"])} />);

    expect(
      screen.queryByRole("button", { name: "Início" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /animar/i }),
    ).not.toBeInTheDocument();
  });

  it("stops animating when a position is chosen by hand", async () => {
    stubMotionPreference(false);
    const user = userEvent.setup();
    render(<ExercisePhotos exercise={exercise(["a/0.jpg", "a/1.jpg"])} />);

    // Starts playing, so the control offers to pause.
    expect(
      screen.getByRole("button", { name: "Pausar animação" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fim" }));

    expect(
      screen.getByRole("button", { name: "Animar movimento" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fim" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not animate on its own when the system asks for reduced motion", () => {
    // The CSS rule in globals.css cannot reach this: the movement here is a
    // component swapping frames on a timer, not a property the browser eases.
    stubMotionPreference(true);
    render(<ExercisePhotos exercise={exercise(["a/0.jpg", "a/1.jpg"])} />);

    // Starts paused, offering to play rather than already playing.
    expect(
      screen.getByRole("button", { name: "Animar movimento" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Início" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("still plays on request when the system asks for reduced motion", async () => {
    // Found 26/08/2026: reduced motion used to hide the play control
    // entirely, leaving no way to see the animation at all. WCAG 2.3.3
    // treats motion someone explicitly asks for differently from motion a
    // page starts on its own — the OS setting should stop the second, not
    // the first.
    stubMotionPreference(true);
    const user = userEvent.setup();
    render(<ExercisePhotos exercise={exercise(["a/0.jpg", "a/1.jpg"])} />);

    await user.click(screen.getByRole("button", { name: "Animar movimento" }));

    expect(
      screen.getByRole("button", { name: "Pausar animação" }),
    ).toBeInTheDocument();
  });

  it("describes only the visible frame, so it is not announced twice", () => {
    stubMotionPreference(true);
    render(<ExercisePhotos exercise={exercise(["a/0.jpg", "a/1.jpg"])} />);

    const described = screen.getAllByRole("img");
    expect(described).toHaveLength(1);
    expect(described[0]).toHaveAccessibleName(
      "Supino Reto com Barra: posição Início",
    );
  });
});
