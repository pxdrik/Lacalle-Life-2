import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "./page";

/**
 * BUG-03 (auditoria externa, 27/08/2026): `dayKey(new Date())` era lido
 * direto no render, então rodava uma vez no servidor (com o relógio do
 * servidor) e de novo no cliente (com o relógio de quem estava lendo) — dois
 * dias diferentes, então o texto do subtítulo e os dados de cada card
 * discordavam do que o servidor mandou, e o React recusava a hidratação
 * (erro #418) a cada carregamento.
 *
 * Estes componentes filhos dependem de repositórios que só existem no
 * navegador (IndexedDB), então o teste aqui é sobre o mecanismo da correção
 * — o servidor nunca produz um dia — e não sobre os cards em si.
 */
vi.mock("@/composition/data-providers", () => ({
  HomeDataProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/features/body", () => ({
  TodayProgress: () => <div>progresso</div>,
}));
vi.mock("@/features/diet/components/today-energy", () => ({
  TodayEnergy: ({ day }: { day: string }) => <div>energia {day}</div>,
}));
vi.mock("@/features/diet/components/today-meals", () => ({
  TodayMeals: ({ day }: { day: string }) => <div>refeições {day}</div>,
}));
vi.mock("@/features/profile/components/profile-incomplete-notice", () => ({
  ProfileIncompleteNotice: () => null,
}));
vi.mock("@/features/workouts/components/today-workout", () => ({
  TodayWorkout: ({ day }: { day: string }) => <div>treino {day}</div>,
}));

describe("hydrating the home page across a day boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the same markup on the server regardless of the server's clock", () => {
    // The bug depended on the server and the client disagreeing about "now" —
    // reproduced here as two servers with different clocks, both of which
    // must render identically because neither one knows the reader's day.
    vi.setSystemTime(new Date(2026, 7, 27, 23, 0));
    const late = renderToStaticMarkup(<HomePage />);

    vi.setSystemTime(new Date(2026, 7, 28, 1, 0));
    const early = renderToStaticMarkup(<HomePage />);

    expect(late).toBe(early);
    // Nothing date-specific has leaked into the server markup.
    expect(late).not.toMatch(/energia|refeições|treino/);
  });

  it("hydrates without warning even when the browser's clock is already a day ahead of the server's, then fills in the real day", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // The server rendered as if "now" were the 27th at 23:00.
    vi.setSystemTime(new Date(2026, 7, 27, 23, 0));
    const serverHtml = renderToStaticMarkup(<HomePage />);

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    // The reader's browser is already on the 28th — exactly the divergence
    // that used to make React refuse to hydrate.
    vi.setSystemTime(new Date(2026, 7, 28, 1, 0));

    act(() => {
      hydrateRoot(container, <HomePage />);
    });

    const hydrationWarning = consoleError.mock.calls.some((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("Hydration")),
    );
    expect(hydrationWarning).toBe(false);

    expect(container.textContent).toContain("energia 2026-08-28");
    expect(container.textContent).toContain("refeições 2026-08-28");
    expect(container.textContent).toContain("treino 2026-08-28");
    expect(container.textContent).toMatch(/sexta-feira, 28 de agosto/i);

    consoleError.mockRestore();
    document.body.removeChild(container);
  });
});
