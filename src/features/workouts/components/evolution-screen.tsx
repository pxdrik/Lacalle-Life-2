"use client";

import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";
import Link from "next/link";
import { useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { Card, cardSurface } from "@/design-system/components/card";
import { Button } from "@/design-system/components/button";
import { Comparison } from "@/design-system/components/comparison";
import { EmptyState } from "@/design-system/components/empty-state";
import { Metric } from "@/design-system/components/metric";
import { Section } from "@/design-system/components/section";
import { Tabs } from "@/design-system/components/tabs";
import { ICONS } from "@/design-system/icons";

import { useSessionHistory } from "../hooks/use-session-history";
import {
  finishedSessions,
  personalRecords,
  recentProgress,
  startOfMonth,
  startOfWeek,
  volumeByPeriod,
  type VolumePoint,
} from "../services/history";
import {
  formatDuration,
  sessionDurationMs,
  sessionProgress,
  sessionVolumeKg,
} from "../services/session-stats";
import type { Session } from "../types/session";
import { VolumeChart } from "./volume-chart";

/** O mesmo corte que `Recordes` já usa — ver o comentário no Histórico. */
const HISTORY_PAGE = 12;

export function EvolutionScreen() {
  const state = useSessionHistory();
  const [chartMetric, setChartMetric] = useState<"volume" | "duration">(
    "volume",
  );
  const [showingAllHistory, setShowingAllHistory] = useState(false);

  if (state.status === "loading") {
    return (
      <div aria-hidden className="space-y-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className={noticeClasses("danger", "block")}>
        <p className="text-ink">Não foi possível carregar seu histórico.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </div>
    );
  }

  const history = finishedSessions(state.sessions);

  if (history.length === 0) {
    // Sprint 3, achado C4 — este bloco desenhava o próprio estado vazio, sem
    // ícone e com um link sublinhado solto, enquanto o bloco de Peso logo
    // acima na mesma rolagem usava `EmptyState` com ícone e botão. Mesma
    // pergunta ("ainda não há nada aqui"), duas respostas visuais, uma tela.
    return (
      <EmptyState
        icon={ICONS.workouts}
        title="Nenhum treino concluído ainda."
        caption="Assim que você finalizar um treino, ele aparece aqui com volume, recordes e histórico."
        action={{ label: "Ir para os treinos", href: "/treinos" }}
      />
    );
  }

  const weekly = volumeByPeriod(history, 12, startOfWeek);
  const monthly = volumeByPeriod(history, 6, startOfMonth);
  const records = personalRecords(history);
  // Dos mesmos baldes que o gráfico semanal desenha, não de uma segunda
  // leitura do histórico — ver o comentário de `recentProgress`.
  const summary = recentProgress(weekly);

  const isDuration = chartMetric === "duration";
  const metric = isDuration
    ? (point: VolumePoint) => point.durationMs
    : (point: VolumePoint) => point.volumeKg;
  const formatMetric = isDuration
    ? formatDuration
    : (kg: number) => `${formatDecimal(kg)} kg`;

  return (
    <div className="space-y-8">
      {/* Sprint 3, achado C1 — a tela abria num controle de métrica e num
          eixo. A primeira coisa que ela oferecia era uma pergunta ("volume ou
          duração?") e a segunda era um gráfico; a comparação ficava por conta
          da cabeça de quem lia.

          Três números e uma variação, todos somados dos mesmos baldes que o
          gráfico abaixo já usa (`recentProgress` recebe `weekly`, não o
          histórico cru, justamente para que resumo e gráfico não possam
          divergir). Nenhuma métrica nova, nenhum score, nenhum nível: a
          direção da variação é desenhada porque é fato, e a cor fica neutra
          porque "subiu" não é elogio — o mesmo raciocínio que `Comparison`
          documenta e que `TodayProgress` já aplica ao peso.

          O período é dito em palavras, no título, porque um "+25%" sem
          denominador visível é pior que nenhum número. */}
      <Section title={`Últimas ${String(summary.weeks)} semanas`} size="compact">
        <div className="grid grid-cols-3 gap-3">
          <Metric
            value={formatDecimal(summary.sessions)}
            label={summary.sessions === 1 ? "treino" : "treinos"}
          />
          <Metric
            value={formatDecimal(summary.volumeKg)}
            unit="kg"
            label="movidos"
          />
          {/* Horas, não `formatDuration`. Aquele formato é de cronômetro de
              uma sessão ("55:00"), e num total de quatro semanas devolvia
              "12:50:00" — 99px de largura, que estourava a terceira coluna
              em 320px nas densidades largas (medido: a caixa ia a 323 num
              limite de 320). Encolher a fonte ou pôr `min-w-0` esconderia o
              sintoma: o defeito é usar formato de sessão para um agregado.

              Hora é a unidade que esta tela já usa para duração somada — o
              próprio gráfico se legenda "horas treinadas". Uma casa decimal
              porque zerar 20 minutos para "0 h" apagaria o único treino de
              quem está começando. */}
          <Metric
            value={formatDecimal(summary.durationMs / 3_600_000, 1)}
            unit="h"
            label="treinando"
          />
        </div>

        {/* Ausente, e não zerado, quando a janela anterior não tem volume —
            é o caso de quem começou a treinar agora, e `volumeByPeriod`
            semeia aquelas semanas com zero de qualquer jeito. Ver a guarda
            em `recentProgress`. */}
        {summary.volumeChange !== null && (
          <Comparison
            className="mt-3"
            delta={Math.round(summary.volumeChange * 100)}
            formatMagnitude={(magnitude) => `${formatDecimal(magnitude)}%`}
            label={`de volume vs. as ${String(summary.weeks)} semanas anteriores`}
            whenZero="mesmo volume"
          />
        )}
      </Section>

      {/* `Tabs` de verdade, não dois botões com `aria-pressed` — achado
          real, 17/09/2026: o componente de aba do design system, com o
          indicador animado e a semântica de `role="tab"`, existia e nunca
          tinha sido usado em lugar nenhum do app. Esta troca era o caso
          mais direto: duas opções, mutuamente exclusivas, exatamente o
          que `Tabs` já resolve. */}
      <Tabs
        idPrefix="evolucao-metrica"
        items={[
          { id: "volume", label: "Volume" },
          { id: "duration", label: "Duração" },
        ]}
        value={chartMetric}
        onChange={(id) => {
          setChartMetric(id === "duration" ? "duration" : "volume");
        }}
      />

      {/* Sprint 5 — estes quatro cabeçalhos escreviam `text-sm font-medium
          text-ink` à mão, junto com outros cinco espalhados pelo app. Agora
          é `Section size="sub"`, que rende exatamente as mesmas classes e o
          mesmo `mt-3`: a migração tira a duplicação sem mover um pixel. */}
      <Section
        size="sub"
        title={isDuration ? "Duração semanal" : "Volume semanal"}
        subtitle={
          isDuration
            ? "Últimas 12 semanas, horas treinadas"
            : "Últimas 12 semanas, em quilos movidos"
        }
      >
        <VolumeChart
          points={weekly}
          format={formatWeek}
          metric={metric}
          formatMetric={formatMetric}
        />
      </Section>

      <Section
        size="sub"
        title={isDuration ? "Duração mensal" : "Volume mensal"}
      >
        <VolumeChart
          points={monthly}
          format={formatMonth}
          metric={metric}
          formatMetric={formatMetric}
        />
      </Section>

      {records.length > 0 && (
        <Section
          size="sub"
          title="Recordes"
          subtitle="Série mais pesada e melhor estimativa de 1RM, quase sempre séries diferentes"
        >
          <Card
            as="ul"
            padded={false}
            className="divide-y divide-line overflow-hidden"
          >
            {/* Sprint 3, achado C2 — `heaviestAt` já era calculado por
                `personalRecords` e jogado fora aqui. "80 kg" sem data não diz
                se é de ontem ou de um ano atrás, que é metade do que faz um
                recorde significar alguma coisa.

                A data é a de `heaviestAt`, não a de `bestOneRepMaxAt`: a
                linha mostra `reps × carga`, e a data tem que ser a daquela
                série, não a de outra. As duas quase sempre são séries
                diferentes — é por isso que o domínio guarda os dois carimbos
                separados — e imprimir as duas seria pedir que alguém
                descubra qual pertence a qual número.

                Três colunas viraram duas de duas linhas. Não é preferência:
                a data como quarta coluna não cabe em 320px ao lado de nome,
                `reps × kg` e 1RM, e o jeito de fazer caber seria truncar o
                nome do exercício. `SessionRow` logo abaixo já empilha data
                sob o nome pelo mesmo motivo. */}
            {records.slice(0, 12).map((record) => (
              <li
                key={record.exerciseId}
                className="flex items-baseline gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{record.name}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    {formatDate(record.heaviestAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums text-ink">
                    {record.repsAtHeaviest} × {formatDecimal(record.heaviestKg)}{" "}
                    kg
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-ink-subtle">
                    1RM {formatDecimal(record.bestOneRepMax)}
                  </p>
                </div>
              </li>
            ))}
          </Card>
        </Section>
      )}

      {/* Sprint 3, achado C3 — a lista renderizava todas as sessões
          concluídas, desde sempre, a cada abertura da tela.

          Medido em Browser Mode antes de decidir qualquer coisa, porque o
          brief proibiu (com razão) chutar um `.slice`: **180 sessões — cerca
          de catorze meses a três treinos por semana — dão 17.319px de lista,
          vinte viewports de rolagem**, e crescem sem teto. Cinco anos seriam
          uns sessenta.

          O que *não* é o problema: encontrar treino recente.
          `finishedSessions` já ordena do mais novo para o mais antigo, então
          o que importa sempre esteve no topo. O problema é só o tamanho.

          Por isso a correção revela em vez de esconder: nada sai da tela,
          nada é julgado "velho demais", nenhuma regra nova sobre relevância
          é inventada. Só o primeiro lote é montado, e o botão traz o resto.
          Doze é o número que `Recordes` logo acima já usa — convenção da
          própria página, não um palpite novo. */}
      <Section size="sub" title="Histórico">
        <ul className="space-y-2">
          {(showingAllHistory ? history : history.slice(0, HISTORY_PAGE)).map(
            (session) => (
              <SessionRow key={session.id} session={session} />
            ),
          )}
        </ul>

        {!showingAllHistory && history.length > HISTORY_PAGE && (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => {
              setShowingAllHistory(true);
            }}
          >
            Mostrar os outros {formatDecimal(history.length - HISTORY_PAGE)}{" "}
            treinos
          </Button>
        )}
      </Section>
    </div>
  );
}

function SessionRow({ session }: { readonly session: Session }) {
  const progress = sessionProgress(session);
  const duration = sessionDurationMs(session);

  return (
    <li>
      <Link
        href={`/sessao/${session.id}`}
        className={cn(
          cardSurface(),
          "flex items-center gap-4 transition-colors duration-150 ease-out hover:border-line-strong",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{session.name}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {formatDate(session.startedAt)}
            <span className="mx-1.5 text-line-strong">·</span>
            {progress.completed}/{progress.total} séries
            {duration !== null && (
              <>
                <span className="mx-1.5 text-line-strong">·</span>
                {formatDuration(duration)}
              </>
            )}
          </p>
        </div>

        <span className="shrink-0 text-sm tabular-nums text-ink-muted">
          {formatDecimal(sessionVolumeKg(session).kg)} kg
        </span>
      </Link>
    </li>
  );
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

function formatWeek(point: VolumePoint): string {
  const date = new Date(point.startsAt);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function formatMonth(point: VolumePoint): string {
  return monthFormatter.format(new Date(point.startsAt));
}
