import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LayoutDashboard, Users } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import type { Weekday } from "@/core/domain/weekday";
import { MemoryStore } from "@/core/storage/memory-store";
import { WorkspaceShell } from "@/design-system/components/workspace-shell";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { RoutinePublishPanel } from "@/features/pro/components/pro/routine-publish-panel";
import type { ProRoutineRepository } from "@/features/pro/data/routine-repository";
import { ProRoutineRepositoryProvider } from "@/features/pro/data/routine-repository-context";
import { RoutineEditor } from "@/features/workouts/components/routine-editor";
import { EXERCISES_STORE } from "@/features/workouts/data/exercise-repository";
import { ExerciseRepositoryProvider } from "@/features/workouts/data/exercise-repository-context";
import { LocalExerciseRepository } from "@/features/workouts/data/local-exercise-repository";
import { LocalRoutineRepository, ROUTINES_STORE } from "@/features/workouts/data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "@/features/workouts/data/session-repository";
import { WorkoutRepositoryProvider } from "@/features/workouts/data/workout-repository-context";
import type { Exercise } from "@/features/workouts/types/exercise";
import type { Routine } from "@/features/workouts/types/routine";
import type { Session } from "@/features/workouts/types/session";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, setDensity, setViewport } from "@/test/geometry";

import { RoutineDraftContext } from "./routine-draft-context";
import { RoutineDraftDays } from "./routine-draft-days";
import type { RoutineDraftRepository } from "./routine-draft-repository";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pro/pacientes/l/treino/r",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * O editor de treino do app dentro do Life Pro (Etapa 8c), medido, como o do
 * plano (`plan-editor.browser.test.tsx`): nada rola de lado, os dias e
 * "Publicar" cabem e são tocáveis, e não há "Iniciar treino" (a sessão é do
 * paciente). E o caminho dos dias: abrir, marcar, salvar pelo rascunho.
 */
const ROUTINE: Routine = {
  id: "r",
  name: "Treino A, inferiores com um nome comprido para quebrar linha",
  notes: "",
  createdAt: 1,
  updatedAt: 1,
  exercises: ["Agachamento livre com barra", "Leg press 45°", "Mesa flexora"].map((name, index) => ({
    id: `e${String(index)}`,
    exerciseId: `ex${String(index)}`,
    name,
    sets: [1, 2, 3].map((set) => ({ id: `e${String(index)}-${String(set)}`, reps: 8, weightKg: 60, rpe: 8, durationSeconds: null })),
    restSeconds: 90,
    notes: "Desça até a coxa ficar paralela ao chão.",
  })),
};

const ROUTINES: ProRoutineRepository = {
  listRoutines: () =>
    Promise.resolve([
      {
        id: "r",
        name: ROUTINE.name,
        hasDraft: true,
        versions: [{ version: 2, name: ROUTINE.name, changeNote: "", publishedAt: "2026-09-30T12:00:00Z", weekdays: [] }],
      },
    ]),
  createRoutine: () => Promise.resolve("r"),
  publish: () => Promise.resolve(3),
};

async function mount() {
  const routines = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  await routines.save(ROUTINE, null);
  let days: readonly Weekday[] = [];
  const saved: (readonly Weekday[])[] = [];
  const draft: RoutineDraftRepository = {
    listAll: () => routines.listAll(),
    getById: (id) => routines.getById(id),
    save: (routine, expected) => routines.save(routine, expected),
    remove: () => Promise.reject(new Error("não")),
    flush: () => Promise.resolve(),
    weekdays: () => Promise.resolve(days),
    setWeekdays: (next) => {
      days = next;
      saved.push(next);
      return Promise.resolve();
    },
  };
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const exercises = new LocalExerciseRepository(new MemoryStore<Exercise>(EXERCISES_STORE));

  render(
    <ThemeProvider>
      <ProRoutineRepositoryProvider repository={ROUTINES}>
        <WorkoutRepositoryProvider repositories={Promise.resolve({ routines: draft, sessions })}>
          <ExerciseRepositoryProvider repository={Promise.resolve(exercises)}>
            <RoutineDraftContext value={draft}>
              <WorkspaceShell
                badge="Pro"
                title="Consultório"
                links={[
                  { href: "/pro", label: "Visão geral", icon: LayoutDashboard },
                  { href: "/pro/pacientes", label: "Pacientes", icon: Users },
                ]}
              >
                <RoutineEditor
                  routineId="r"
                  backHref="/pro/pacientes"
                  backLabel="Paciente"
                  showStart={false}
                  catalogueOnly
                  belowName={<RoutineDraftDays />}
                />
                <RoutinePublishPanel linkId="l" routineId="r" patientHref="/pro/pacientes" />
              </WorkspaceShell>
            </RoutineDraftContext>
          </ExerciseRepositoryProvider>
        </WorkoutRepositoryProvider>
      </ProRoutineRepositoryProvider>
    </ThemeProvider>,
  );
  return { saved };
}

function expectTouchable(control: HTMLElement) {
  control.scrollIntoView({ block: "center" });
  for (const hit of hitTargetsAcross(control)) {
    expect(control.contains(hit), `o toque em "${control.textContent ?? ""}" cai em outro elemento`).toBe(true);
  }
}

const WIDTHS = [...PHONE_WIDTHS, 768, DESKTOP_WIDTH, 1440];

describe("editor do treino no Life Pro", () => {
  for (const width of WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 800);
        setDensity(density);
        await mount();

        const publish = await screen.findByRole("button", { name: "Publicar versão 3" });
        const days = await screen.findByRole("button", { name: "Dias do treino: Quando quiser" });
        const root = document.documentElement;
        expect(root.scrollWidth - root.clientWidth, "a página rola de lado").toBeLessThanOrEqual(0);
        expect(screen.queryByRole("button", { name: /Iniciar treino/ }), "a sessão é do paciente").toBeNull();

        for (const element of [publish, days]) {
          const box = element.getBoundingClientRect();
          expect(box.left, "fora da tela").toBeGreaterThanOrEqual(-0.5);
          expect(box.right, "fora da tela").toBeLessThanOrEqual(window.innerWidth + 0.5);
        }
        expectTouchable(days);
        expectTouchable(publish);
        window.scrollTo(0, 0);
        cleanup();
      });
    }
  }
});

describe("dias do treino no editor do Life Pro", () => {
  it("o treinador escolhe os dias, sem os atalhos de treino de quem está usando, e grava pelo rascunho", async () => {
    await setViewport(390, 800);
    const { saved } = await mount();
    await userEvent.click(await screen.findByRole("button", { name: "Dias do treino: Quando quiser" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Dias de treino" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /Salvar seleção atual/ })).toBeNull();
    expect(dialog).toHaveTextContent("Sem nenhum dia, ele fica em Treinos");

    await userEvent.click(within(dialog).getByRole("button", { name: "Quinta" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Terça" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("button", { name: "Dias do treino: Ter, Qui" })).toBeInTheDocument();
    await waitFor(() => {
      expect(saved.at(-1)).toEqual(["thu", "tue"]);
    });
    cleanup();
  });
});
