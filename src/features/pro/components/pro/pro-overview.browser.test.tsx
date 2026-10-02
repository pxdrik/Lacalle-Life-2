import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pageShell } from "@/design-system/components/page-shell";
import { DENSITIES, DESKTOP_WIDTH, PHONE_WIDTHS, hitTargetsAcross, setDensity, setViewport } from "@/test/geometry";

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository, patientLink } from "../../data/fake-care-repository.test-helper";
import { FollowUpRepositoryProvider } from "../../data/follow-up-repository-context";
import { ProRoutineRepositoryProvider } from "../../data/routine-repository-context";
import { NOT_SHARED } from "../../types/follow-up";
import { ProOverview } from "./pro-overview";

vi.mock("next/navigation", () => ({ usePathname: () => "/pro", useRouter: () => ({ push: vi.fn() }) }));

/**
 * A Visão geral (Etapa 6), medida: os números, a lista e "Precisa de
 * atenção" com nome longo não passam da tela nem encavalam, e cada linha é
 * tocável onde aparece.
 */
const LONG = "Juliana Rocha Albuquerque de Vasconcellos";
const at = (day: string) => new Date(`${day}T07:10:00`).getTime();

function mount() {
  render(
    <main className={pageShell()}>
      <CareRepositoryProvider repository={fakeCareRepository({ links: [patientLink({ id: "a", label: LONG }), patientLink({ id: "b", label: "Jorge Almeida" })] })}>
        <ProRoutineRepositoryProvider repository={{ listRoutines: () => Promise.resolve([]), createRoutine: () => Promise.resolve("r"), publish: () => Promise.resolve(1) }}>
          <FollowUpRepositoryProvider
            repository={{
              listSessions: () => Promise.resolve([]),
              listDiary: () => Promise.resolve({ planMeals: [], days: [] }),
              listBody: () => Promise.resolve([]),
              overview: () =>
                Promise.resolve([
                  { linkId: "a", lastSessionAt: at("2026-09-20"), sessions: [], lastDiaryDay: "2026-09-21", weightNow: 102.4, weightMonthAgo: 104.9 },
                  { linkId: "b", lastSessionAt: NOT_SHARED, sessions: NOT_SHARED, lastDiaryDay: "2026-10-02", weightNow: NOT_SHARED, weightMonthAgo: NOT_SHARED },
                ]),
            }}
          >
            <ProOverview />
          </FollowUpRepositoryProvider>
        </ProRoutineRepositoryProvider>
      </CareRepositoryProvider>
    </main>,
  );
}

function expectWhole(text: Element, container: Element) {
  const range = document.createRange();
  range.selectNodeContents(text);
  expect(range.getBoundingClientRect().width, "texto cortado").toBeLessThanOrEqual(text.getBoundingClientRect().width + 0.5);
  expect(text.getBoundingClientRect().right, "texto passa da borda").toBeLessThanOrEqual(container.getBoundingClientRect().right + 0.5);
}
const apart = (a: DOMRect, b: DOMRect) =>
  a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;
const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T15:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Visão geral com acompanhamento", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH, 1600]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        mount();

        const list = (await screen.findByRole("heading", { name: "Pacientes" })).closest("section")!;
        expect(overflow(), "a página rola de lado").toBeLessThanOrEqual(0);
        for (const row of within(list).getAllByRole("link")) {
          const facts = [...row.children];
          for (let i = 1; i < facts.length; i++) {
            expect(apart(facts[i - 1]!.getBoundingClientRect(), facts[i]!.getBoundingClientRect()), "dados do paciente encavalados").toBe(true);
          }
          for (const fact of facts) expect(fact.getBoundingClientRect().right, "dado passa da linha").toBeLessThanOrEqual(row.getBoundingClientRect().right + 0.5);
          row.scrollIntoView({ block: "center" });
          for (const hit of hitTargetsAcross(row)) expect(row.contains(hit), "o toque cai fora da linha").toBe(true);
        }
        expectWhole(within(list).getByText(LONG), list);

        const attention = screen.getByRole("heading", { name: "Precisa de atenção" }).closest("section")!;
        const [item] = within(attention).getAllByRole("link");
        expect(item!.getBoundingClientRect().height).toBeGreaterThanOrEqual(43.5);
        expectWhole(item!.lastElementChild!, attention);
        cleanup();
      });
    }
  }
});
