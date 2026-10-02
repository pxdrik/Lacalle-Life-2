"use client";

import { CircleCheck, Dumbbell, LayoutDashboard, Plus, TriangleAlert } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { dayKey, shiftDay } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import { buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Metric } from "@/design-system/components/metric";
import { noticeClasses } from "@/design-system/components/notice";
import { PageHeader } from "@/design-system/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";

import { useOverview } from "../../hooks/use-overview";
import { usePatients } from "../../hooks/use-patients";
import { STALE_DAYS, overviewOf, type Attention, type OverviewPatient } from "../../services/follow-up";
import { Person } from "../admin/person";

const TODAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DATE = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

/**
 * Visão geral (protótipo v3; acompanhamento da Etapa 6, protótipo aprovado
 * em 02/10/2026). Os números e a lista mostram só o que cada paciente
 * libera; quem não libera um item aparece como "Não libera", nunca como zero.
 * "Precisa de atenção" lista quem está parado há {@link STALE_DAYS} dias ou
 * fez menos da metade dos dias do treino na semana.
 */
export function ProOverview() {
  const { state } = usePatients();
  const [now] = useState(() => Date.now());
  const today = dayKey(new Date(now));
  const title = TODAY.format(new Date(now));
  const overview = useOverview(state.status === "ready" ? state.links : null, today, now);

  return (
    <>
      <PageHeader icon={LayoutDashboard} title="Visão geral" subtitle={title.charAt(0).toUpperCase() + title.slice(1)}>
        <Link href="/pro/pacientes" className={buttonClasses("primary")}>
          <Plus aria-hidden className="size-4" />
          Adicionar paciente
        </Link>
      </PageHeader>

      <div className="mt-8 space-y-6">
        {state.status === "loading" && <Skeleton className="h-32" />}
        {state.status === "error" && (
          <div role="alert" className={noticeClasses("danger", "block")}>
            <p className="text-ink">Não foi possível carregar os pacientes.</p>
            <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e recarregue a página.</p>
          </div>
        )}
        {state.status === "ready" &&
          (state.links.length === 0 && state.invites.length === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              title="Seu consultório começa pelos pacientes."
              caption="Convide o primeiro paciente em Pacientes. Quando ele aceitar, o acompanhamento aparece aqui."
              action={{ label: "Ir para Pacientes", href: "/pro/pacientes" }}
            />
          ) : (
            <Dashboard
              links={state.links.filter((link) => link.status === "active")}
              invites={state.invites.length}
              overview={overview}
              today={today}
              now={now}
            />
          ))}
      </div>
    </>
  );
}

function Dashboard({
  links,
  invites,
  overview,
  today,
  now,
}: {
  readonly links: readonly { readonly id: string; readonly label: string; readonly createdAt: string }[];
  readonly invites: number;
  readonly overview: ReturnType<typeof useOverview>;
  readonly today: string;
  readonly now: number;
}) {
  if (overview.status === "loading") return <Skeleton className="h-64" />;
  const summary = overview.status === "ready" ? overviewOf(today, now, links, overview.rows, overview.routinesByLink) : null;
  const attention = summary?.patients.filter((patient) => patient.attention !== null) ?? [];

  return (
    <>
      <Card className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile value={String(links.length)} label="Pacientes ativos" caption={invites === 1 ? "1 convite esperando" : `${String(invites)} convites esperando`} />
        {summary !== null && (
          <>
            <Tile
              value={summary.trained.of === 0 ? "—" : String(summary.trained.count)}
              {...(summary.trained.of === 0 ? {} : { unit: `de ${String(summary.trained.of)}` })}
              label="Treinaram nos últimos 7 dias"
              caption={summary.trained.of === 0 ? "Ninguém libera os treinos ainda" : "Dos que liberam os treinos"}
            />
            <Tile
              value={summary.logged.of === 0 ? "—" : String(summary.logged.count)}
              {...(summary.logged.of === 0 ? {} : { unit: `de ${String(summary.logged.of)}` })}
              label="Registraram o diário nos últimos 3 dias"
              caption={summary.logged.of === 0 ? "Ninguém libera o diário ainda" : "Dos que liberam o diário"}
            />
            <Tile value={String(summary.stale)} label={`Parados há ${String(STALE_DAYS)} dias ou mais`} caption="Sem treino e sem diário" />
          </>
        )}
      </Card>

      {overview.status === "error" && (
        <div role="alert" className={noticeClasses("danger", "block")}>
          <p className="text-ink">Não foi possível carregar o acompanhamento.</p>
          <p className="mt-1.5 text-sm text-ink-muted">Os pacientes continuam em Pacientes. Recarregue a página para tentar de novo.</p>
        </div>
      )}

      {summary !== null && links.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-labelledby="visao-pacientes">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="visao-pacientes" className="text-sm font-semibold text-ink">
                Pacientes
              </h2>
              <p className="text-xs text-ink-subtle">Só o que cada um libera</p>
            </div>
            <ul className="overflow-hidden rounded-lg border border-line bg-surface">
              {summary.patients.map((patient) => (
                <PatientRow key={patient.linkId} patient={patient} today={today} />
              ))}
            </ul>
          </section>
          <section aria-labelledby="visao-atencao">
            <h2 id="visao-atencao" className="mb-3 text-sm font-semibold text-ink">
              Precisa de atenção
            </h2>
            {attention.length === 0 ? (
              <p className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 text-sm text-ink-muted">
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
                Todos em dia com o que liberam.
              </p>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-line bg-surface">
                {attention.map((patient) => (
                  <li key={patient.linkId} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/pro/pacientes/${patient.linkId}` as Route}
                      className="flex min-h-11 items-start gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-muted"
                    >
                      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-sm bg-warning-surface text-warning-text">
                        {patient.attention!.kind === "stale" ? <TriangleAlert className="size-4" /> : <Dumbbell className="size-4" />}
                      </span>
                      <span className="min-w-0 text-sm break-words text-ink">
                        <span className="font-medium">{patient.label}</span> {describeAttention(patient.attention!)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Tile({ value, unit, label, caption }: { readonly value: string; readonly unit?: string; readonly label: string; readonly caption: string }) {
  return (
    <div className="min-w-0">
      <Metric value={value} label={label} {...(unit === undefined ? {} : { unit })} />
      <p className="mt-1 text-xs text-ink-muted">{caption}</p>
    </div>
  );
}

function describeAttention(attention: Attention): string {
  return attention.kind === "stale"
    ? `está sem treino e sem diário há ${String(attention.days)} dias.`
    : `fez ${String(attention.done)} de ${String(attention.due)} dias do treino nesta semana.`;
}

function whenDay(day: string, today: string): string {
  if (day === today) return "Hoje";
  if (day === shiftDay(today, -1)) return "Ontem";
  return DATE.format(new Date(`${day}T12:00:00`));
}

function PatientRow({ patient, today }: { readonly patient: OverviewPatient; readonly today: string }) {
  const facts = [
    {
      label: "Último treino",
      value:
        patient.lastSessionAt === undefined
          ? "Não libera"
          : patient.lastSessionAt === null
            ? "Nenhum ainda"
            : `${whenDay(dayKey(new Date(patient.lastSessionAt)), today)}, ${TIME.format(new Date(patient.lastSessionAt))}`,
    },
    {
      label: "Último diário",
      value: patient.lastDiaryDay === undefined ? "Não libera" : patient.lastDiaryDay === null ? "Nenhum ainda" : whenDay(patient.lastDiaryDay, today),
    },
    {
      label: "Peso",
      value:
        patient.weightNow === undefined
          ? "Não libera"
          : patient.weightNow === null
            ? "Nenhum ainda"
            : `${formatDecimal(patient.weightNow)} kg${patient.weightChange === null ? "" : ` (${patient.weightChange > 0 ? "+" : patient.weightChange < 0 ? "−" : ""}${formatDecimal(Math.abs(patient.weightChange))} em 30 dias)`}`,
    },
  ];
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/pro/pacientes/${patient.linkId}` as Route}
        className="grid gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-150 ease-out hover:bg-muted md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:items-center"
      >
        <Person name={patient.label} detail="" />
        {facts.map((fact) => (
          <span key={fact.label} className="min-w-0 text-sm">
            <span className="block text-xs text-ink-subtle">{fact.label}</span>
            <span className={fact.value === "Não libera" ? "text-ink-subtle" : "text-ink"}>{fact.value}</span>
          </span>
        ))}
      </Link>
    </li>
  );
}
