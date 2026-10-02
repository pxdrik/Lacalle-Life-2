import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { ToastProvider } from "@/design-system/components/toast";

import { EXERCISES_STORE } from "../data/exercise-repository";
import { ExerciseRepositoryProvider } from "../data/exercise-repository-context";
import { LocalExerciseRepository } from "../data/local-exercise-repository";
import { LocalPrescribedRoutineRepository, PRESCRIBED_ROUTINES_STORE } from "../data/prescribed-routine-repository";
import { PrescribedRoutineRepositoryProvider } from "../data/prescribed-routine-repository-context";
import { LocalRoutineRepository, ROUTINES_STORE } from "../data/routine-repository";
import { LocalSessionRepository, SESSIONS_STORE } from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import type { Exercise } from "../types/exercise";
import type { PrescribedRoutine } from "../types/prescribed-routine";
import type { Routine } from "../types/routine";
import type { Session } from "../types/session";
import { PrescribedRoutineScreen } from "./prescribed-routine-screen";
import { RoutineList } from "./routine-list";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

/**
 * O treino recebido no app do paciente (Life Pro, Etapa 8d): iniciar cria uma
 * sessão dele que guarda de qual treino veio; a cópia vira um treino dele com
 * ids novos e o treino do treinador não muda; a tela abre só para leitura e
 * conta como vista; sem repositório (conta anônima), Treinos fica como antes.
 */
const PRESCRIBED: PrescribedRoutine = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Treino A, inferiores",
  notes: "",
  professionalName: "Rafael Moura",
  version: 2,
  changeNote: "",
  publishedAt: "2026-09-30T12:00:00Z",
  exercises: [
    {
      id: "ex-1",
      exerciseId: "cat-agachamento",
      name: "Agachamento livre com barra",
      sets: [
        { id: "s-1", reps: 8, weightKg: 60, rpe: 7, durationSeconds: null },
        { id: "s-2", reps: 8, weightKg: 60, rpe: 8, durationSeconds: null },
      ],
      restSeconds: 120,
      notes: "Desça até a coxa ficar paralela ao chão.",
    },
  ],
  previous: null,
  weekdays: ["mon", "wed", "fri"],
  linkEnded: false,
  seenVersion: 0,
  createdAt: 1,
  updatedAt: 1,
};

async function setup() {
  const routines = new LocalRoutineRepository(new MemoryStore<Routine>(ROUTINES_STORE));
  const sessions = new LocalSessionRepository(new MemoryStore<Session>(SESSIONS_STORE));
  const prescribed = new LocalPrescribedRoutineRepository(new MemoryStore<PrescribedRoutine>(PRESCRIBED_ROUTINES_STORE));
  await prescribed.replaceAll([PRESCRIBED]);
  const exercises = new LocalExerciseRepository(new MemoryStore<Exercise>(EXERCISES_STORE));
  const wrap = (page: React.ReactNode, withPrescribed = true) => (
    <ToastProvider>
      <WorkoutRepositoryProvider repositories={Promise.resolve({ routines, sessions })}>
        <ExerciseRepositoryProvider repository={Promise.resolve(exercises)}>
          {withPrescribed ? (
            <PrescribedRoutineRepositoryProvider repository={Promise.resolve(prescribed)}>{page}</PrescribedRoutineRepositoryProvider>
          ) : (
            page
          )}
        </ExerciseRepositoryProvider>
      </WorkoutRepositoryProvider>
    </ToastProvider>
  );
  return { routines, sessions, prescribed, wrap };
}

describe("treino recebido no app do paciente", () => {
  it("aparece em Do seu treinador, acima de Seus treinos, com os dias só para leitura", async () => {
    const { wrap } = await setup();
    render(wrap(<RoutineList />));

    const section = await screen.findByRole("region", { name: "Do seu treinador" });
    expect(section).toHaveTextContent("Treino A, inferiores");
    expect(section).toHaveTextContent("Rafael Moura · versão 2, 30/09 · 1 exercício · 2 séries");
    expect(section).toHaveTextContent("Seg, Qua, Sex");
    expect(screen.getByRole("heading", { name: "Seus treinos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dias do treino/ })).toBeNull();
    expect(screen.queryByText("Atualizado"), "a primeira versão que chega não é atualização").toBeNull();
  });

  it("Iniciar cria uma sessão da pessoa que guarda de qual treino veio", async () => {
    push.mockClear();
    const { sessions, prescribed, wrap } = await setup();
    render(wrap(<RoutineList />));
    await userEvent.click(await screen.findByRole("button", { name: "Iniciar Treino A, inferiores" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    const [session] = await sessions.listAll();
    expect(session).toMatchObject({ routineId: PRESCRIBED.id, name: "Treino A, inferiores", finishedAt: null });
    expect(session!.exercises[0]!.sets.map((set) => set.planned?.weightKg)).toEqual([60, 60]);
    expect(push).toHaveBeenCalledWith(`/sessao/${session!.id}`);
    expect(await prescribed.listAll(), "iniciar mexeu no treino do treinador").toEqual([PRESCRIBED]);
  });

  it("Fazer uma cópia cria um treino dela, com ids novos, e não mexe no treino do treinador", async () => {
    const { routines, prescribed, wrap } = await setup();
    render(wrap(<RoutineList />));
    await userEvent.click(await screen.findByRole("button", { name: "Fazer uma cópia de Treino A, inferiores" }));

    expect(await screen.findByText("Cópia criada em Seus treinos. O treino do treinador continua igual.")).toBeInTheDocument();
    const [copy] = await routines.listAll();
    expect(copy).toMatchObject({ name: "Treino A, inferiores (cópia)" });
    expect(copy!.id, "a cópia divide o id com o treino do treinador").not.toBe(PRESCRIBED.id);
    expect(copy!.exercises[0]!.id, "a cópia divide ids de exercício").not.toBe("ex-1");
    expect(await prescribed.listAll()).toEqual([PRESCRIBED]);
  });

  it("aberto, é só leitura, inicia pelo topo e conta como visto", async () => {
    push.mockClear();
    const { sessions, prescribed, wrap } = await setup();
    render(wrap(<PrescribedRoutineScreen routineId={PRESCRIBED.id} />));

    expect(await screen.findByRole("heading", { level: 1, name: "Treino A, inferiores" })).toBeInTheDocument();
    expect(screen.getByLabelText("Série 1: 60 kg, 8 repetições, RPE 7")).toBeInTheDocument();
    expect(screen.getByText("Desça até a coxa ficar paralela ao chão.")).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox"), "campo editável no treino do treinador").toEqual([]);
    expect(screen.queryAllByRole("spinbutton")).toEqual([]);
    await waitFor(async () => {
      expect((await prescribed.listAll())[0]!.seenVersion).toBe(2);
    });

    await userEvent.click(screen.getByRole("button", { name: "Iniciar treino" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    expect((await sessions.listAll())[0]).toMatchObject({ routineId: PRESCRIBED.id });
  });

  it("versão nova: Atualizado, e o aviso abre o que mudou, com a nota e a comparação, e conta como visto", async () => {
    const { prescribed, wrap } = await setup();
    const [squat] = PRESCRIBED.exercises;
    await prescribed.replaceAll([
      {
        ...PRESCRIBED,
        changeNote: "Mais carga no agachamento.",
        previous: {
          version: 1,
          exercises: [{ ...squat!, sets: squat!.sets.map((set) => ({ ...set, weightKg: 50 })) }, { ...squat!, id: "ex-0", name: "Cadeira extensora" }],
          weekdays: ["mon", "wed", "fri"],
        },
      },
    ]);
    await prescribed.markSeen(PRESCRIBED.id, 1);
    render(wrap(<RoutineList />));

    expect(await screen.findByText("Atualizado")).toBeInTheDocument();
    expect(screen.getByText(/Rafael Moura atualizou seu treino/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver o que mudou" }));

    const sheet = await screen.findByRole("dialog", { name: "O que mudou na versão 2" });
    expect(within(sheet).getByText("Nota de Rafael Moura: “Mais carga no agachamento.”")).toBeInTheDocument();
    const [heavier, removed] = within(sheet).getAllByRole("listitem");
    expect(heavier).toHaveTextContent(/^Agachamento livre com barra50 kg.*60 kg$/);
    expect(within(heavier!).getByText("50 kg").tagName, "o valor de antes vem riscado").toBe("S");
    expect(removed).toHaveTextContent("Cadeira extensoraSaiu do treino");
    await waitFor(async () => {
      expect((await prescribed.listAll())[0]!.seenVersion).toBe(2);
    });
  });

  it("sem repositório de treinos recebidos, Treinos fica como antes", async () => {
    const { wrap } = await setup();
    render(wrap(<RoutineList />, false));

    expect(await screen.findByText("Nenhum treino ainda.")).toBeInTheDocument();
    expect(screen.queryByText("Do seu treinador")).toBeNull();
    expect(screen.queryByText("Seus treinos")).toBeNull();
  });
});

describe("a coleção de treinos recebidos", () => {
  it("a troca guarda o que o aparelho já viu e apaga o treino que sumiu do servidor", async () => {
    const repo = new LocalPrescribedRoutineRepository(new MemoryStore<PrescribedRoutine>(PRESCRIBED_ROUTINES_STORE));
    const other = { ...PRESCRIBED, id: "outro", publishedAt: "2026-10-01T12:00:00Z" };
    await repo.replaceAll([PRESCRIBED, other]);
    await repo.markSeen(PRESCRIBED.id, 2);
    await repo.markSeen(PRESCRIBED.id, 1);

    await repo.replaceAll([{ ...PRESCRIBED, version: 3 }]);
    expect(await repo.listAll()).toEqual([{ ...PRESCRIBED, version: 3, seenVersion: 2 }]);
  });
});
