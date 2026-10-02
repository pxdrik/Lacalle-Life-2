import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository, patientLink } from "../../data/fake-care-repository.test-helper";
import type { FollowUpRepository } from "../../data/follow-up-repository";
import { FollowUpRepositoryProvider } from "../../data/follow-up-repository-context";
import type { ProRoutineRepository } from "../../data/routine-repository";
import { ProRoutineRepositoryProvider } from "../../data/routine-repository-context";
import { NOT_SHARED, type OverviewRow } from "../../types/follow-up";
import { ProOverview } from "./pro-overview";

/**
 * A Visão geral com o acompanhamento (Etapa 6): os números só pelo que cada
 * paciente libera, "Não libera" no lugar de zero, e quem precisa de atenção,
 * com o motivo. Hoje é sexta, 02/10/2026.
 */
const at = (day: string, hour = 7) => new Date(`${day}T${String(hour).padStart(2, "0")}:10:00`).getTime();
const LINKS = [
  patientLink({ id: "ana", label: "Ana Luísa Prado" }),
  patientLink({ id: "jorge", label: "Jorge Almeida" }),
  patientLink({ id: "camila", label: "Camila Teixeira" }),
  patientLink({ id: "paulo", label: "Paulo Dias", status: "ended", endedAt: "2026-09-12T12:00:00Z" }),
];
const ROWS: OverviewRow[] = [
  { linkId: "ana", lastSessionAt: at("2026-10-02"), sessions: [], lastDiaryDay: "2026-10-02", weightNow: 68.6, weightMonthAgo: 69.2 },
  {
    linkId: "jorge",
    lastSessionAt: at("2026-09-28"),
    sessions: [{ routineId: "ra", startedAt: at("2026-09-28") }],
    lastDiaryDay: "2026-10-01",
    weightNow: NOT_SHARED,
    weightMonthAgo: NOT_SHARED,
  },
  { linkId: "camila", lastSessionAt: NOT_SHARED, sessions: NOT_SHARED, lastDiaryDay: "2026-09-26", weightNow: null, weightMonthAgo: null },
];

function mount(rows: readonly OverviewRow[] | Error = ROWS) {
  const followUp: FollowUpRepository = {
    listSessions: () => Promise.resolve([]),
    listDiary: () => Promise.resolve({ planMeals: [], days: [] }),
    listBody: () => Promise.resolve([]),
    overview: () => (rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows)),
  };
  const routines: ProRoutineRepository = {
    listRoutines: (linkId) =>
      Promise.resolve(
        linkId === "jorge"
          ? [{ id: "ra", name: "Treino A", hasDraft: false, versions: [{ version: 1, name: "Treino A", changeNote: "", publishedAt: "2026-09-20T12:00:00Z", weekdays: ["mon", "wed", "fri"] }] }]
          : [],
      ),
    createRoutine: () => Promise.resolve("r"),
    publish: () => Promise.resolve(1),
  };
  render(
    <CareRepositoryProvider repository={fakeCareRepository({ links: LINKS })}>
      <ProRoutineRepositoryProvider repository={routines}>
        <FollowUpRepositoryProvider repository={followUp}>
          <ProOverview />
        </FollowUpRepositoryProvider>
      </ProRoutineRepositoryProvider>
    </CareRepositoryProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T15:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Visão geral com acompanhamento", () => {
  it("os números só pelo que cada um libera", async () => {
    mount();
    const trained = (await screen.findByText("Treinaram nos últimos 7 dias")).closest("div.min-w-0")!;
    expect(trained).toHaveTextContent("2de 2");
    expect(screen.getByText("Registraram o diário nos últimos 3 dias").closest("div.min-w-0")).toHaveTextContent("2de 3");
    expect(screen.getByText("Parados há 5 dias ou mais").closest("div.min-w-0")).toHaveTextContent("1");
    expect(screen.getByText("Pacientes ativos").closest("div.min-w-0")).toHaveTextContent("3");
  });

  it("a lista diz 'Não libera' em vez de zero, e o encerrado não aparece", async () => {
    mount();
    const list = (await screen.findByRole("heading", { name: "Pacientes" })).closest("section")!;
    const jorge = within(list).getByRole("link", { name: /Jorge Almeida/ });
    expect(jorge).toHaveTextContent("Último treinoseg., 28/09, 07:10");
    expect(jorge).toHaveTextContent("PesoNão libera");
    expect(within(list).getByRole("link", { name: /Ana Luísa Prado/ })).toHaveTextContent("Hoje, 07:10");
    expect(within(list).getByRole("link", { name: /Ana Luísa Prado/ })).toHaveTextContent("68,6 kg (−0,6 em 30 dias)");
    expect(within(list).queryByText("Paulo Dias")).toBeNull();
  });

  it("precisa de atenção: parado e poucos dias do treino, cada um com o motivo", async () => {
    mount();
    const section = (await screen.findByRole("heading", { name: "Precisa de atenção" })).closest("section")!;
    expect(within(section).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Jorge Almeida fez 1 de 3 dias do treino nesta semana.",
      "Camila Teixeira está sem treino e sem diário há 6 dias.",
    ]);
    expect(within(section).getByRole("link", { name: /Camila/ })).toHaveAttribute("href", "/pro/pacientes/camila");
  });

  it("sem o acompanhamento, os pacientes ativos ainda aparecem e o erro diz o que fazer", async () => {
    mount(new Error("rede"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o acompanhamento.");
    expect(screen.getByText("Pacientes ativos").closest("div.min-w-0")).toHaveTextContent("3");
  });
});
