import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FollowUpRepository } from "../../data/follow-up-repository";
import { FollowUpRepositoryProvider } from "../../data/follow-up-repository-context";
import { NOT_SHARED, type BodyPoint, type DiaryWeek, type PatientSession } from "../../types/follow-up";
import type { PlanSummary } from "../../types/plan";
import type { RoutineSummary } from "../../types/routine";
import { PatientBody, PatientDiary, PatientWorkouts } from "./patient-follow-up";

/**
 * As abas do acompanhamento (Etapa 6) na tela: os números e a semana em
 * Treinos, o prescrito ao lado do feito, o diário comparado com o plano, a
 * evolução, e o aviso quando o paciente não libera. Hoje é sexta, 02/10/2026.
 */
const at = (day: string, hour = 7) => new Date(`${day}T${String(hour).padStart(2, "0")}:10:00`).getTime();
const ROUTINE_A: RoutineSummary = {
  id: "ra",
  name: "Treino A, inferiores",
  hasDraft: false,
  versions: [{ version: 1, name: "Treino A, inferiores", changeNote: "", publishedAt: "2026-09-20T12:00:00Z", weekdays: ["mon", "wed", "fri"] }],
};
const ROUTINE_B: RoutineSummary = { ...ROUTINE_A, id: "rb", name: "Treino B, superiores", versions: [{ ...ROUTINE_A.versions[0]!, weekdays: ["tue", "thu"] }] };
const session = (id: string, day: string, routineId: string | null, name: string): PatientSession => ({
  id,
  routineId,
  name,
  startedAt: at(day),
  durationMs: 52 * 60_000,
  setsDone: 3,
  setsTotal: 4,
  volumeKg: 1500,
  exercises: [
    {
      exerciseId: "cat-agachamento",
      name: "Agachamento livre com barra",
      deltaKg: 2.5,
      sets: [
        { planned: { weightKg: 60, reps: 8, durationSeconds: null }, done: { weightKg: 60, reps: 8, rpe: 7, durationSeconds: null }, warmup: false },
        { planned: { weightKg: 60, reps: 8, durationSeconds: null }, done: { weightKg: 62.5, reps: 8, rpe: 8.5, durationSeconds: null }, warmup: false },
        { planned: { weightKg: 60, reps: 8, durationSeconds: null }, done: null, warmup: false },
      ],
    },
  ],
});
const SESSIONS = [
  session("s1", "2026-10-02", "ra", "Treino A, inferiores"),
  session("s2", "2026-10-01", "rb", "Treino B, superiores"),
  session("s3", "2026-09-30", "ra", "Treino A, inferiores"),
  session("s4", "2026-09-27", null, "Corrida leve"),
];

function fake(over: Partial<FollowUpRepository> = {}): FollowUpRepository {
  return {
    listSessions: () => Promise.resolve(SESSIONS),
    listDiary: () => Promise.resolve({ planMeals: [], days: [] }),
    listBody: () => Promise.resolve([]),
    overview: () => Promise.resolve([]),
    ...over,
  };
}
const mount = (node: React.ReactNode, repository = fake()) =>
  render(<FollowUpRepositoryProvider repository={repository}>{node}</FollowUpRepositoryProvider>);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T15:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("aba Treinos", () => {
  it("os números do topo e a semana com as faltas de segunda e terça", async () => {
    mount(<PatientWorkouts linkId="l" routines={[ROUTINE_A, ROUTINE_B]} />);
    expect(await screen.findByText("Dias do treino feitos na semana")).toBeInTheDocument();
    expect(screen.getByText("Faltou seg (Treino A, inferiores), ter (Treino B, superiores)")).toBeInTheDocument();
    expect(screen.getByText("Dias do treino feitos na semana").parentElement).toHaveTextContent("3de 5");
    expect(screen.getByText("3 seus, 1 por conta própria")).toBeInTheDocument();

    const week = screen.getByRole("heading", { name: "Esta semana" }).closest("section")!;
    const cells = within(week).getAllByRole("listitem");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "Seg 28Não treinouTreino A, inferiores",
      "Ter 29Não treinouTreino B, superiores",
      "Qua 30FeitoTreino A, inferiores",
      "Qui 01FeitoTreino B, superiores",
      "Sex 02FeitoTreino A, inferiores",
      "Sáb 03Sem treino",
      "Dom 04Sem treino",
    ]);
    expect(cells[4], "hoje não é anunciado").toHaveAttribute("aria-current", "date");
  });

  it("o treino mais recente abre com o prescrito ao lado do feito; os outros abrem num toque", async () => {
    mount(<PatientWorkouts linkId="l" routines={[ROUTINE_A, ROUTINE_B]} />);
    const latest = await screen.findByRole("button", { name: /Treino A, inferiores.*sex/i, expanded: true });
    expect(latest).toHaveTextContent("Seu treino");
    expect(screen.getByLabelText("Série 2: prescrito 60 kg × 8, feito 62,5 kg × 8, RPE 8,5")).toBeInTheDocument();
    expect(screen.getByLabelText("Série 3: prescrito 60 kg × 8, não feita")).toBeInTheDocument();
    expect(screen.getByText("+2,5 kg desde a última vez")).toBeInTheDocument();
    expect(screen.getByText(/1 série não feita/)).toBeInTheDocument();

    const own = screen.getByRole("button", { name: /Corrida leve/ });
    expect(own).toHaveTextContent("Por conta própria");
    await userEvent.click(own);
    expect(own).toHaveAttribute("aria-expanded", "true");
    expect(latest).toHaveAttribute("aria-expanded", "false");
  });

  it("não libera: diz isso, sem erro", async () => {
    mount(<PatientWorkouts linkId="l" routines={[]} />, fake({ listSessions: () => Promise.resolve(NOT_SHARED) }));
    expect(await screen.findByText("O paciente não libera os treinos.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("erro de leitura é erro, e diz o que fazer", async () => {
    mount(<PatientWorkouts linkId="l" routines={[]} />, fake({ listSessions: () => Promise.reject(new Error("rede")) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os treinos.");
  });
});

describe("aba Diário", () => {
  const plan: PlanSummary = {
    id: "p",
    name: "Recomposição",
    hasDraft: false,
    versions: [{ version: 1, name: "Recomposição", changeNote: "", publishedAt: "2026-09-20T12:00:00Z", meals: [] }],
  };
  const week: DiaryWeek = {
    planMeals: [
      { id: "m1", name: "Almoço" },
      { id: "m2", name: "Jantar" },
    ],
    days: [
      { day: "2026-09-29", ownDiet: true, meals: {}, eatenKcal: 1800 },
      { day: "2026-10-01", ownDiet: false, meals: { m1: "checked", m2: "edited" }, eatenKcal: 1650 },
    ],
  };

  it("cada refeição do plano por dia, a dieta própria e o futuro como planejado", async () => {
    const listDiary = vi.fn<FollowUpRepository["listDiary"]>(() => Promise.resolve(week));
    mount(<PatientDiary linkId="l" plan={plan} />, fake({ listDiary }));
    const lunch = await screen.findByRole("row", { name: /^Almoço/ });
    const cells = within(lunch).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual(["Sem registro", "Dieta própria", "Sem registro", "Feito", "Sem registro", "Planejado", "Planejado"]);
    expect(within(screen.getByRole("row", { name: /^Jantar/ })).getAllByRole("cell")[3]).toHaveTextContent("Fora do plano");
    expect(screen.getByRole("row", { name: /^Total comido/ })).toHaveTextContent("1.650 kcal");
    expect(listDiary).toHaveBeenLastCalledWith("l", "2026-09-28", "2026-10-04", { id: "p", meals: [] });

    await userEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    expect(listDiary).toHaveBeenLastCalledWith("l", "2026-09-21", "2026-09-27", { id: "p", meals: [] });
    expect(screen.getByRole("button", { name: "Próxima semana" })).toBeEnabled();
  });

  it("não deixa ir para depois da semana de hoje", async () => {
    mount(<PatientDiary linkId="l" plan={null} />);
    expect(await screen.findByRole("button", { name: "Próxima semana" })).toBeDisabled();
  });
});

describe("aba Evolução", () => {
  const points: BodyPoint[] = [
    { day: "2026-07-04", weightKg: 71.8, measurements: [{ site: "waist", label: "Cintura", cm: 78 }] },
    { day: "2026-09-26", weightKg: 68.6, measurements: [{ site: "waist", label: "Cintura", cm: 74.5 }, { site: "hip", label: "Quadril", cm: 99 }] },
  ];

  it("peso com a variação e as medidas do primeiro ao último registro", async () => {
    mount(<PatientBody linkId="l" />, fake({ listBody: () => Promise.resolve(points) }));
    expect(await screen.findByText(/3,2 kg a menos desde 04\/07/)).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /^Cintura/ })).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["78", "74,5", "−3,5"]);
    expect(within(screen.getByRole("row", { name: /^Quadril/ })).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["—", "99", "—"]);
  });

  it("sem registro, diz isso", async () => {
    mount(<PatientBody linkId="l" />);
    expect(await screen.findByText("Nenhum peso ou medida registrado ainda.")).toBeInTheDocument();
  });
});
