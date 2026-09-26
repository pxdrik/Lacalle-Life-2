import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  overflowX,
  setDensity,
  setViewport,
} from "@/test/geometry";

import {
  LocalRoutineRepository,
  ROUTINES_STORE,
} from "../data/routine-repository";
import {
  LocalSessionRepository,
  SESSIONS_STORE,
} from "../data/session-repository";
import { WorkoutRepositoryProvider } from "../data/workout-repository-context";
import type { Session } from "../types/session";
import { EvolutionScreen } from "./evolution-screen";

/**
 * A Evolução, medida com CSS real.
 *
 * O achado C3 só existe como número: "o histórico renderiza tudo" não é um
 * defeito até alguém medir quanto é "tudo". Medido aqui antes da correção:
 * 180 sessões davam 17.319px de lista e vinte viewports de rolagem. jsdom
 * devolveria zero para todos eles.
 *
 * As fixtures são `MemoryStore` — nenhum IndexedDB, nenhum schema, nenhuma
 * escrita em persistência real.
 */

const DAY = 86_400_000;

/**
 * Uma sessão a cada dois dias, andando para trás a partir de agora.
 *
 * O intervalo importa: `volumeByPeriod` agrupa por semana a partir de
 * `Date.now()`, então um fixture com datas fixas cairia fora da janela de
 * doze semanas assim que o calendário passasse, e o teste começaria a falhar
 * sozinho num dia qualquer. Relativo ao presente, ele mede sempre a mesma
 * coisa.
 */
function session(index: number, weightKg = 60): Session {
  const startedAt = Date.now() - index * 2 * DAY;

  return {
    id: `s${String(index)}`,
    routineId: null,
    name: `Treino ${String.fromCharCode(65 + (index % 3))}`,
    startedAt,
    finishedAt: startedAt + 55 * 60_000,
    createdAt: 1,
    updatedAt: 1,
    exercises: [
      {
        id: `se${String(index)}`,
        exerciseId: "supino-reto-barra",
        name: "Supino Reto com Barra",
        restSeconds: null,
        notes: "",
        sets: [
          {
            id: `set${String(index)}`,
            reps: 8,
            weightKg,
            rpe: null,
            durationSeconds: null,
            isCompleted: true,
            planned: null,
          },
        ],
      },
    ],
  };
}

async function mount(sessionList: readonly Session[]) {
  const sessions = new LocalSessionRepository(
    new MemoryStore<Session>(SESSIONS_STORE),
  );
  const routines = new LocalRoutineRepository(new MemoryStore(ROUTINES_STORE));
  for (const one of sessionList) await sessions.save(one, null);

  render(
    <WorkoutRepositoryProvider
      repositories={Promise.resolve({ routines, sessions })}
    >
      <EvolutionScreen />
    </WorkoutRepositoryProvider>,
  );
}

const many = (count: number) =>
  Array.from({ length: count }, (_, index) => session(index));

describe("EVOLUTION-01 — há contexto antes do primeiro gráfico", () => {
  it("resume o período acima das abas e do gráfico", async () => {
    await setViewport(390, 800);
    await mount(many(20));

    const summary = await screen.findByText("Últimas 4 semanas");
    const tabs = screen.getByRole("tablist");
    const chartHeading = screen.getByText("Volume semanal");

    expect(summary.getBoundingClientRect().top).toBeLessThan(
      tabs.getBoundingClientRect().top,
    );
    expect(summary.getBoundingClientRect().top).toBeLessThan(
      chartHeading.getBoundingClientRect().top,
    );
  });

  it("nomeia o período em palavras, para o percentual ter denominador", async () => {
    await setViewport(390, 800);
    await mount(many(20));

    await screen.findByText("Últimas 4 semanas");
    expect(
      screen.getByText(/vs\. as 4 semanas anteriores/),
    ).toBeInTheDocument();
  });
});

describe("EVOLUTION-02 — os números são os dados, não uma aproximação", () => {
  /**
   * Quatro semanas são 28 dias; com uma sessão a cada dois dias, quinze
   * sessões cobrem 28 dias (índices 0 a 14). O balde semanal começa na
   * segunda-feira, então a contagem exata depende do dia em que o teste
   * roda — o que se afirma aqui é a relação, não um literal que mentiria
   * numa terça.
   */
  it("conta só as sessões da janela, nunca o histórico inteiro", async () => {
    await setViewport(390, 800);
    await mount(many(60));
    await screen.findByText("Últimas 4 semanas");

    const treinos = screen.getByText(/^treinos?$/);
    const value = Number(
      treinos.previousElementSibling?.textContent?.replace(/\D/g, ""),
    );

    // 60 sessões cobrem ~120 dias; a janela de 28 dias não pode contê-las.
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(20);
  });

  it("omite a comparação quando não há janela anterior com volume", async () => {
    await setViewport(390, 800);
    // Duas semanas de treino: a janela anterior existe como balde, mas está
    // vazia. É o caso de todo usuário novo.
    await mount(many(7));
    await screen.findByText("Últimas 4 semanas");

    expect(
      screen.queryByText(/vs\. as 4 semanas anteriores/),
    ).not.toBeInTheDocument();
    // O que aconteceu continua sendo dito.
    expect(screen.getByText(/^treinos?$/)).toBeInTheDocument();
  });
});

describe("EVOLUTION-03 — a data do recorde é a do domínio", () => {
  it("mostra a data da série mais pesada, não a de hoje", async () => {
    await setViewport(390, 800);
    // A mais pesada é a mais antiga, de propósito: se a UI imprimisse
    // qualquer data conveniente, "hoje" passaria despercebido.
    const heaviestAt = Date.now() - 40 * DAY;
    await mount([session(0, 60), { ...session(20, 100), startedAt: heaviestAt }]);

    await screen.findByText("Recordes");

    const expected = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(heaviestAt));

    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe("EVOLUTION-04 — o estado vazio fala a língua do design system", () => {
  it("usa a mesma anatomia dos outros: ícone, frase, saída", async () => {
    await setViewport(390, 800);
    await mount([]);

    const title = await screen.findByText("Nenhum treino concluído ainda.");
    const card = title.closest("div")!;

    // Ícone contido, não um link sublinhado solto: era a divergência com o
    // bloco de Peso, na mesma rolagem.
    expect(card.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Ir para os treinos" }),
    ).toBeInTheDocument();
  });
});

describe("EVOLUTION-05 — histórico longo não domina a tela", () => {
  it("monta o primeiro lote, e o botão traz o resto sem perder nada", async () => {
    await setViewport(390, 800);
    await mount(many(180));
    await screen.findByText("Histórico");

    const rows = () =>
      document.querySelectorAll("section:last-of-type ul > li").length;

    expect(rows()).toBe(12);

    const more = screen.getByRole("button", {
      name: /Mostrar os outros 168 treinos/,
    });
    await userEvent.click(more);

    // Nada foi descartado — o botão revela, não filtra.
    expect(rows()).toBe(180);
    expect(
      screen.queryByRole("button", { name: /Mostrar os outros/ }),
    ).not.toBeInTheDocument();
  });

  it("corta a rolagem do histórico a uma fração do que era", async () => {
    await setViewport(390, 800);
    await mount(many(180));
    await screen.findByText("Histórico");

    const list = document.querySelector("section:last-of-type ul")!;

    // Medido antes da correção: 17.319px. O corte tem que deixar isto na
    // casa de um punhado de viewports, não de vinte.
    expect(list.getBoundingClientRect().height).toBeLessThan(2000);
  });

  it("não oferece o botão quando não há nada escondido", async () => {
    await setViewport(390, 800);
    await mount(many(5));
    await screen.findByText("Histórico");

    expect(
      screen.queryByRole("button", { name: /Mostrar os outros/ }),
    ).not.toBeInTheDocument();
  });
});

/**
 * EVOLUTION-06, e o que ele deliberadamente **não** cobre.
 *
 * A seção "Volume semanal" transborda 52px a 320px na densidade Confortável.
 * Medido isoladamente — `VolumeChart` montado sozinho, com os mesmos doze
 * pontos e nenhum código desta sprint por perto, dá exatamente os mesmos
 * 52px. É defeito **pré-existente** do gráfico com doze rótulos numa largura
 * estreita (o mensal, com seis, cabe), não regressão daqui, e consertá-lo é
 * investigação própria fora do escopo desta sprint: o brief proíbe mexer em
 * gráfico.
 *
 * Registrado no relatório e excluído daqui por nome, não por um laço mais
 * frouxo. Um teste que aceitasse transbordo em qualquer seção também
 * aceitaria o transbordo que esta sprint introduzisse — e introduziu um, na
 * primeira tentativa: `formatDuration` num total de quatro semanas devolvia
 * "12:50:00" e estourava a terceira coluna do resumo.
 */
describe("EVOLUTION-06 e responsividade", () => {
  /** As seções que esta sprint escreveu ou reescreveu. */
  const OWNED = ["Últimas 4 semanas", "Recordes", "Histórico"];

  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`cabe em ${String(width)}px, densidade ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);
        await mount(many(20));
        await screen.findByText("Últimas 4 semanas");

        const sections = [...document.querySelectorAll("section")].filter(
          (section) => {
            const heading = section.querySelector("h2")?.textContent ?? "";
            return OWNED.includes(heading.trim());
          },
        );

        expect(sections).toHaveLength(OWNED.length);
        for (const section of sections) {
          expect(overflowX(section)).toBeLessThanOrEqual(0);
        }
      });
    }
  }
});

describe("EVOLUTION-07 — os períodos existentes continuam funcionando", () => {
  it("mantém as abas de Volume e Duração, e a troca entre elas", async () => {
    await setViewport(390, 800);
    await mount(many(20));
    await screen.findByText("Volume semanal");

    expect(screen.getByText("Volume mensal")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Duração" }));

    expect(screen.getByText("Duração semanal")).toBeInTheDocument();
    expect(screen.getByText("Duração mensal")).toBeInTheDocument();
    // O resumo não é a aba: ele descreve o período, não a métrica escolhida.
    expect(screen.getByText("Últimas 4 semanas")).toBeInTheDocument();
  });

});
