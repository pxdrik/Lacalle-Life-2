import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { EXERCISES_STORE } from "../data/exercise-repository";
import { ExerciseRepositoryProvider } from "../data/exercise-repository-context";
import { LocalExerciseRepository } from "../data/local-exercise-repository";
import type { Exercise } from "../types/exercise";
import { ExerciseBrowser } from "./exercise-browser";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/exercicios",
}));

/**
 * Reaching "create" from the catalogue.
 *
 * Three entry points, each covering a case the others miss: the header
 * button (always visible, no search needed — the one that was missing
 * entirely until a real user had to type a made-up name just to make the
 * empty state show it), the inline row while searching (pre-fills the term
 * you already typed, "supino" finding eight and wanting the ninth your gym
 * has), and the empty-state button (the search found literally nothing).
 */

function exercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    primaryMuscles: ["chest"],
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

function mount(
  catalogue: readonly Exercise[],
  props: Partial<React.ComponentProps<typeof ExerciseBrowser>> = {},
) {
  const repository = new LocalExerciseRepository(
    new MemoryStore<Exercise>(EXERCISES_STORE),
  );
  const ready = Promise.all(
    catalogue.map((item) => repository.save(item, null)),
  );

  render(
    <ExerciseRepositoryProvider repository={ready.then(() => repository)}>
      <ExerciseBrowser persistQuery={false} {...props} />
    </ExerciseRepositoryProvider>,
  );
}

const CATALOGUE = [
  exercise("supino-reto", "Supino Reto com Barra"),
  exercise("supino-inclinado", "Supino Inclinado com Halteres"),
  exercise("agachamento", "Agachamento Livre com Barra"),
];

const search = () => screen.getByLabelText("Buscar exercício");
const createRow = () => screen.queryByRole("button", { name: /^Criar/ });

/**
 * The running count reads "1 exercício selecionado", but the number is its
 * own `<span>` for the tabular digits — `getByText` only matches a single
 * node's own text, not text assembled from a child element plus a sibling
 * text node, so an exact string never finds it.
 */
function selectedCount(): HTMLElement | null {
  return screen.queryByText(
    (_, element) =>
      element?.tagName === "P" &&
      /selecionad/.test(element.textContent ?? ""),
  );
}

describe("creating from a search that found something", () => {
  it("offers to create the term anyway", async () => {
    mount(CATALOGUE);
    await screen.findByText("Supino Reto com Barra");

    await userEvent.type(search(), "supino");

    // Two matches, and still a way out for the one that is missing.
    expect(
      screen.getByText("Supino Inclinado com Halteres"),
    ).toBeInTheDocument();
    expect(createRow()).toBeInTheDocument();
  });

  it("names the term, so the button says what it will make", async () => {
    mount(CATALOGUE);
    await screen.findByText("Supino Reto com Barra");

    await userEvent.type(search(), "supino pegada fechada");

    expect(
      screen.getByRole("button", { name: "Criar “supino pegada fechada”" }),
    ).toBeInTheDocument();
  });

  it("opens the form", async () => {
    mount(CATALOGUE);
    await screen.findByText("Supino Reto com Barra");

    await userEvent.type(search(), "supino");
    await userEvent.click(createRow()!);

    expect(screen.getByLabelText("Nome do exercício")).toBeInTheDocument();
  });
});

describe("while browsing without a search", () => {
  it("offers the always-visible header button, but not the inline search row — 183 curated entries should not collect duplicates from a standing prompt over the list itself", async () => {
    mount(CATALOGUE);
    await screen.findByText("Supino Reto com Barra");

    expect(createRow()).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Novo exercício" }),
    ).toBeInTheDocument();
  });

  it("the header button opens the form with no name pre-filled — nothing was searched", async () => {
    mount(CATALOGUE);
    await screen.findByText("Supino Reto com Barra");

    await userEvent.click(screen.getByRole("button", { name: "Novo exercício" }));

    expect(screen.getByLabelText("Nome do exercício")).toHaveValue("");
  });

  it("ignores a search of only spaces for the inline row", async () => {
    mount(CATALOGUE);
    await screen.findByText("Supino Reto com Barra");

    await userEvent.type(search(), "   ");

    expect(createRow()).not.toBeInTheDocument();
  });
});

describe("immediate selection (single exercise, swapping a slot)", () => {
  it("reports the exercise as soon as its row is tapped, once", async () => {
    const onSelect = vi.fn();
    mount(CATALOGUE, { onSelect });
    await screen.findByText("Supino Reto com Barra");

    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar Supino Reto com Barra" }),
    );

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "supino-reto" }),
    );
  });
});

describe("multiple selection (building a routine)", () => {
  it("toggles a row into the batch instead of reporting it immediately", async () => {
    const onConfirmSelection = vi.fn();
    mount(CATALOGUE, { selectionMode: "multiple", onConfirmSelection });
    await screen.findByText("Supino Reto com Barra");

    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar Supino Reto com Barra" }),
    );

    expect(onConfirmSelection).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", {
        name: "Remover Supino Reto com Barra da seleção",
      }),
    ).toBeInTheDocument();
    expect(selectedCount()?.textContent).toBe("1 exercício selecionado");
  });

  it("un-selects on a second tap of the same row", async () => {
    mount(CATALOGUE, { selectionMode: "multiple" });
    await screen.findByText("Supino Reto com Barra");

    // The button's own accessible name changes with selection state, so a
    // fixed reference to it would stop resolving after the first click —
    // look it up fresh each time, by the row's fixed identity instead.
    const row = () =>
      screen.getByRole("button", {
        name: /^(Adicionar|Remover) Supino Reto com Barra/,
      });
    await userEvent.click(row());
    await userEvent.click(row());

    expect(
      screen.getByRole("button", { name: "Adicionar Supino Reto com Barra" }),
    ).toBeInTheDocument();
    expect(selectedCount()?.textContent).toBe("0 exercícios selecionados");
  });

  it("confirms every selected exercise at once, in the plural, on 'Adicionar'", async () => {
    const onConfirmSelection = vi.fn();
    mount(CATALOGUE, { selectionMode: "multiple", onConfirmSelection });
    await screen.findByText("Supino Reto com Barra");

    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar Supino Reto com Barra" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Adicionar Agachamento Livre com Barra",
      }),
    );

    expect(selectedCount()?.textContent).toBe("2 exercícios selecionados");

    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    // Order not asserted: `listAll()` makes no promise about it, only the
    // repository's write order does, and the fixture saves concurrently.
    expect(onConfirmSelection).toHaveBeenCalledOnce();
    const confirmed = onConfirmSelection.mock.calls[0]?.[0] as
      | readonly { id: string }[]
      | undefined;
    expect(confirmed?.map((exercise) => exercise.id).sort()).toEqual([
      "agachamento",
      "supino-reto",
    ]);
  });

  it("keeps the running count even when a filter hides every match", async () => {
    mount(CATALOGUE, { selectionMode: "multiple" });
    await screen.findByText("Supino Reto com Barra");

    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar Supino Reto com Barra" }),
    );
    await userEvent.type(search(), "zzzz");

    expect(selectedCount()?.textContent).toBe("1 exercício selecionado");
  });

  it("disables 'Adicionar' with nothing selected yet", async () => {
    mount(CATALOGUE, { selectionMode: "multiple" });
    await screen.findByText("Supino Reto com Barra");

    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
  });
});
