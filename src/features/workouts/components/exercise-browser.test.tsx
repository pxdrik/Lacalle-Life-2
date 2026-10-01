import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { EXERCISES_STORE } from "../data/exercise-repository";
import { ExerciseRepositoryProvider } from "../data/exercise-repository-context";
import { LocalExerciseRepository } from "../data/local-exercise-repository";
import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
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
  sessions: readonly Session[] = [],
) {
  const repository = new LocalExerciseRepository(
    new MemoryStore<Exercise>(EXERCISES_STORE),
  );
  const ready = Promise.all(
    catalogue.map((item) => repository.save(item, null)),
  );

  // Todo lugar real que mostra esta tela tem os treinos por perto (os
  // recentes e mais feitos, 10.4, saem deles).
  const sessionStore = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const routines = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  const sessionsReady = Promise.all(sessions.map((item) => sessionStore.save(item, null)));

  render(
    <WorkoutRepositoryProvider repositories={sessionsReady.then(() => ({ routines, sessions: sessionStore }))}>
      <ExerciseRepositoryProvider repository={ready.then(() => repository)}>
        <ExerciseBrowser persistQuery={false} {...props} />
      </ExerciseRepositoryProvider>
    </WorkoutRepositoryProvider>,
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

    expect(onConfirmSelection).toHaveBeenCalledOnce();
    const confirmed = onConfirmSelection.mock.calls[0]?.[0] as
      | readonly { id: string }[]
      | undefined;
    // Pick order, not the catalogue's alphabetical order: `state.exercises`
    // (the catalogue) always lists Agachamento before Supino, and confirming
    // used to filter through that list instead of through the batch itself —
    // this exact click sequence used to come back reordered to match it.
    expect(confirmed?.map((exercise) => exercise.id)).toEqual([
      "supino-reto",
      "agachamento",
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

/**
 * Roadmap 10.1 a 10.4 (30/09/2026), pelo protótipo aprovado: cartões de
 * grupo no topo, recentes e mais feitos, a linha enxuta e as 6 regiões no
 * filtro de músculo.
 */
describe("refinamentos da tela Exercícios", () => {
  const GROUPED = [
    exercise("supino", "Supino Reto com Barra"),
    { ...exercise("rosca", "Rosca Direta"), primaryMuscles: ["biceps" as const], equipment: ["dumbbell" as const] },
    { ...exercise("esteira", "Esteira"), primaryMuscles: ["quads" as const], movementPattern: "cardio" as const, equipment: ["cardio-machine" as const] },
    // Peito como secundário: o grupo é pelo principal, então não entra em Peito.
    { ...exercise("triceps", "Tríceps Testa"), primaryMuscles: ["triceps" as const], secondaryMuscles: ["chest" as const] },
  ];

  function session(id: string, startedAt: number, ids: readonly string[]): Session {
    return {
      id,
      routineId: null,
      name: "Treino",
      startedAt,
      finishedAt: startedAt + 3_600_000,
      exercises: ids.map((exerciseId) => ({
        id: `${id}-${exerciseId}`,
        exerciseId,
        name: exerciseId,
        restSeconds: null,
        notes: "",
        sets: [{ id: "s", reps: 8, weightKg: 60, rpe: null, durationSeconds: null, isCompleted: true, planned: null }],
      })),
      createdAt: startedAt,
      updatedAt: startedAt,
    };
  }

  it("os cartões contam pelo grupo do catálogo, e tocar filtra; Todos volta", async () => {
    const user = userEvent.setup();
    mount(GROUPED);

    const peito = await screen.findByRole("button", { name: /^Peito/ });
    expect(peito).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /^Cardio/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /^Todos/ })).toHaveTextContent("4");

    await user.click(peito);
    expect(peito).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Supino Reto com Barra")).toBeInTheDocument();
    expect(screen.queryByText("Tríceps Testa")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Todos/ }));
    expect(await screen.findByText("Tríceps Testa")).toBeInTheDocument();
  });

  it("a linha mostra um músculo e um equipamento, com ponto", async () => {
    // Dois músculos e dois equipamentos: o caso que antes virava paredão.
    mount([
      { ...exercise("bicicleta", "Abdominal Bicicleta"), primaryMuscles: ["abs", "obliques"], equipment: ["bodyweight", "band"] },
    ]);
    expect(await screen.findByText("Abdômen · Peso corporal")).toBeInTheDocument();
  });

  it("recentes e mais feitos aparecem com a lista em repouso, e somem com busca ou grupo", async () => {
    const user = userEvent.setup();
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const DAY = 86_400_000;
    mount(GROUPED, {}, [
      session("a", today.getTime() - 5 * DAY, ["supino"]),
      session("b", today.getTime() - DAY, ["supino", "rosca"]),
    ]);

    expect(await screen.findByRole("heading", { name: "Feitos recentemente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mais feitos" })).toBeInTheDocument();
    expect(screen.getAllByText("Peito · Barra · Ontem")).toHaveLength(1);
    expect(screen.getByText("Peito · Barra · 2 treinos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Braços/ }));
    expect(screen.queryByRole("heading", { name: "Feitos recentemente" })).not.toBeInTheDocument();
  });

  it("o filtro de músculo abre por região; Peito escolhe direto", async () => {
    const user = userEvent.setup();
    mount(GROUPED);

    await user.click(await screen.findByRole("button", { name: "Filtros" }));
    const filterSheet = screen.getByRole("group", { name: "Músculo" });
    const ombros = within(filterSheet).getByRole("button", { name: /^Ombros/ });
    expect(ombros).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Deltoide lateral" })).not.toBeInTheDocument();

    await user.click(ombros);
    const group = screen.getByRole("group", { name: "Músculos de Ombros" });
    await user.click(within(group).getByRole("button", { name: "Todos" }));
    for (const name of ["Deltoide anterior", "Deltoide lateral", "Deltoide posterior"]) {
      expect(within(group).getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    }
    expect(ombros).toHaveTextContent("3");

    expect(within(filterSheet).getByRole("button", { name: "Peito" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("só o catálogo (Life Pro, Etapa 8c)", () => {
  // Exercício criado nunca sincroniza: um criado pelo treinador chegaria ao
  // paciente sem foto, sem músculo e sem cardio.
  const mine: Exercise = { ...exercise("meu-supino", "Supino da Minha Academia"), isCustom: true, classification: "user" };

  it("esconde o exercício criado por quem usa e os três jeitos de criar", async () => {
    mount([...CATALOGUE, mine], { catalogueOnly: true, onSelect: vi.fn() });
    expect(await screen.findByText("Supino Reto com Barra")).toBeInTheDocument();
    expect(screen.queryByText("Supino da Minha Academia")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo exercício" })).not.toBeInTheDocument();

    await userEvent.type(search(), "supino");
    expect(createRow()).not.toBeInTheDocument();

    await userEvent.clear(search());
    await userEvent.type(search(), "remada cavalinho");
    expect(await screen.findByText("Nenhum exercício corresponde à busca.")).toBeInTheDocument();
    expect(createRow()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar busca e filtros" })).toBeInTheDocument();
  });

  it("sem a opção, o exercício criado aparece, como sempre", async () => {
    mount([...CATALOGUE, mine], { onSelect: vi.fn() });
    expect(await screen.findByText("Supino da Minha Academia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo exercício" })).toBeInTheDocument();
  });
});
