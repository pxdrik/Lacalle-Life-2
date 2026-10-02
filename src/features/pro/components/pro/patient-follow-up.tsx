"use client";

import { ChevronLeft, ChevronRight, CircleCheck, CircleDot, Clock, Lock, Minus, Circle } from "lucide-react";
import { useCallback, useState } from "react";

import { WEEKDAY_SHORT_LABELS } from "@/core/domain/weekday";
import { dayKey, shiftDay } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { Badge } from "@/design-system/components/badge";
import { Card } from "@/design-system/components/card";
import { Metric } from "@/design-system/components/metric";
import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";
import { TrendChart } from "@/design-system/components/trend-chart";

import { useFollowUpRepository } from "../../data/follow-up-repository-context";
import { useFollowUp, type FollowUpState } from "../../hooks/use-follow-up";
import { weekOf, weekStart, workoutTiles, type WeekDay } from "../../services/follow-up";
import type { BodyPoint, DiaryWeek, MealDayState, PatientSession, SessionSet, SetTarget } from "../../types/follow-up";
import type { PlanSummary } from "../../types/plan";
import type { RoutineSummary } from "../../types/routine";

/**
 * O acompanhamento na página do paciente (Etapa 6, protótipo aprovado em
 * 02/10/2026): Treinos, Diário e Evolução, só leitura, cada um só quando o
 * paciente libera. Os números são os do app, lidos na hora pelo banco.
 */

const DAY_MS = 86_400_000;
const WHEN = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const SHORT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const shortDay = (day: string) => SHORT.format(new Date(`${day}T12:00:00`));
const kg = (value: number) => `${formatDecimal(value)} kg`;

function Loading({ state, what, children }: { readonly state: FollowUpState<unknown>; readonly what: string; readonly children: React.ReactNode }) {
  if (state.status === "loading") return <Skeleton className="h-48" />;
  if (state.status === "error") {
    return (
      <div role="alert" className={noticeClasses("danger", "block")}>
        <p className="text-ink">Não foi possível carregar {what}.</p>
        <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e abra a aba de novo.</p>
      </div>
    );
  }
  if (state.status === "not-shared") return <NotShared what={what} />;
  return children;
}

function NotShared({ what }: { readonly what: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-line-strong p-5 text-sm text-ink-muted">
      <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
      <p className="min-w-0">
        <span className="block font-medium text-ink">O paciente não libera {what}.</span>
        Ele escolhe isso no app, em Perfil, Acompanhamento. O que você prescreveu continua em Plano e treino.
      </p>
    </div>
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

// ---------------------------------------------------------------------------
// Treinos
// ---------------------------------------------------------------------------

export function PatientWorkouts({ linkId, routines }: { readonly linkId: string; readonly routines: readonly RoutineSummary[] }) {
  const repository = useFollowUpRepository();
  const [now] = useState(() => Date.now());
  const load = useCallback(() => repository.listSessions(linkId, now - 60 * DAY_MS), [repository, linkId, now]);
  const state = useFollowUp(load);

  return (
    <Loading state={state} what="os treinos">
      {state.status === "ready" && <Workouts sessions={state.value} routines={routines} now={now} />}
    </Loading>
  );
}

function Workouts({ sessions, routines, now }: { readonly sessions: readonly PatientSession[]; readonly routines: readonly RoutineSummary[]; readonly now: number }) {
  const today = dayKey(new Date(now));
  const tiles = workoutTiles(today, now, sessions, routines);
  const week = weekOf(today, sessions, routines);
  const prescribed = new Set(routines.map((routine) => routine.id));
  const [open, setOpen] = useState<string | null>(sessions[0]?.id ?? null);
  const missed = tiles.missed.map((day) => `${WEEKDAY_SHORT_LABELS[day.weekday].toLowerCase()} (${day.prescribed.join(", ")})`);

  return (
    <div className="space-y-6">
      <Card className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          value={tiles.daysDue === 0 ? "—" : String(tiles.daysDone)}
          {...(tiles.daysDue === 0 ? {} : { unit: `de ${String(tiles.daysDue)}` })}
          label="Dias do treino feitos na semana"
          caption={tiles.daysDue === 0 ? "Sem dias prescritos até hoje" : missed.length === 0 ? "Nenhuma falta" : `Faltou ${missed.join(", ")}`}
        />
        <Tile
          value={String(tiles.last14)}
          label="Treinos nos últimos 14 dias"
          caption={`${String(tiles.last14Prescribed)} seus, ${String(tiles.last14 - tiles.last14Prescribed)} por conta própria`}
        />
        <Tile
          value={formatDecimal(tiles.weekVolumeKg, 0)}
          unit="kg"
          label="Volume da semana"
          caption={tiles.weekVolumeChange === null ? "Sem a semana anterior para comparar" : `${tiles.weekVolumeChange > 0 ? "+" : ""}${String(tiles.weekVolumeChange)}% sobre a semana anterior`}
        />
        <Tile
          value={tiles.averageMinutes === null ? "—" : String(tiles.averageMinutes)}
          {...(tiles.averageMinutes === null ? {} : { unit: "min" })}
          label="Duração média"
          caption="Nos últimos 14 dias"
        />
      </Card>

      <section aria-labelledby="semana-treino">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 id="semana-treino" className="font-semibold text-ink">Esta semana</h3>
          <p className="text-xs text-ink-subtle">
            {shortDay(week[0]!.day)} a {shortDay(week[6]!.day)} · os dias são os do treino que você prescreveu
          </p>
        </div>
        {/* Uma linha por dia até a tela larga; sete colunas só onde cabem.
            Em quatro colunas no celular, "Não treinou" passava da célula
            (visto vermelho em 320 a 414px). */}
        <ol className="overflow-hidden rounded-lg border border-line bg-surface lg:grid lg:grid-cols-7">
          {week.map((day) => (
            <WeekCell key={day.day} day={day} today={today} />
          ))}
        </ol>
      </section>

      <section aria-labelledby="treinos-feitos">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 id="treinos-feitos" className="font-semibold text-ink">Treinos feitos</h3>
          <p className="text-xs text-ink-subtle">Últimos 60 dias · toque para ver série por série</p>
        </div>
        {sessions.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface p-5 text-sm text-ink-muted">Nenhum treino finalizado nos últimos 60 dias.</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-line bg-surface">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                fromTrainer={session.routineId !== null && prescribed.has(session.routineId)}
                open={open === session.id}
                onToggle={() => {
                  setOpen((current) => (current === session.id ? null : session.id));
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const WEEK_STATE = {
  done: { icon: CircleCheck, label: "Feito", className: "font-medium text-accent-text" },
  missed: { icon: Circle, label: "Não treinou", className: "text-warning-text" },
  due: { icon: Clock, label: "Por fazer", className: "text-ink-muted" },
  free: { icon: Minus, label: "Sem treino", className: "text-ink-subtle" },
} as const;

function WeekCell({ day, today }: { readonly day: WeekDay; readonly today: string }) {
  // Num dia sem treino prescrito, treinar por conta própria também aparece.
  const state = day.state === "free" && day.done.length > 0 ? WEEK_STATE.done : WEEK_STATE[day.state];
  const Icon = state.icon;
  const names = day.done.length > 0 ? day.done : day.prescribed;
  return (
    <li
      aria-current={day.day === today ? "date" : undefined}
      className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-1.5 lg:border-b-0 lg:border-l lg:px-2.5 lg:first:border-l-0">
      <span className={cn("w-14 shrink-0 text-[0.6875rem] font-semibold tracking-wide uppercase lg:w-auto", day.day === today ? "text-accent-text" : "text-ink-subtle")}>
        {WEEKDAY_SHORT_LABELS[day.weekday]} {day.day.slice(8)}
      </span>
      <span className={cn("flex shrink-0 items-center gap-1 text-xs", state.className)}>
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {state.label}
      </span>
      {names.length > 0 && <span className="min-w-0 flex-1 basis-40 text-xs break-words text-ink-muted lg:basis-auto">{names.join(", ")}</span>}
    </li>
  );
}

function SessionRow({
  session,
  fromTrainer,
  open,
  onToggle,
}: {
  readonly session: PatientSession;
  readonly fromTrainer: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const panel = `sessao-${session.id}`;
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className={cn(
          "flex min-h-11 w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left text-sm transition-colors duration-150 ease-out hover:bg-muted",
          open && "bg-accent-surface hover:bg-accent-surface",
        )}
      >
        <span className="min-w-0 flex-1 basis-56">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium break-words text-ink">{session.name}</span>
            <Badge state={fromTrainer ? "concluido" : "neutro"}>{fromTrainer ? "Seu treino" : "Por conta própria"}</Badge>
          </span>
          <span className="mt-0.5 block text-xs text-ink-subtle">{WHEN.format(new Date(session.startedAt))}</span>
        </span>
        <span className="text-xs text-ink-muted tabular-nums">
          {Math.round(session.durationMs / 60_000)} min · {session.setsDone} de {session.setsTotal} séries · {formatDecimal(session.volumeKg, 0)} kg
        </span>
      </button>
      {open && (
        <div id={panel} className="space-y-4 border-t border-line px-4 py-4">
          {session.exercises.length === 0 && <p className="text-sm text-ink-muted">Treino sem exercícios.</p>}
          {session.exercises.map((exercise, index) => (
            // A lista do treino não reordena: o índice é estável.
            <ExerciseDetail key={`${exercise.exerciseId}-${String(index)}`} name={exercise.name} sets={exercise.sets} deltaKg={exercise.deltaKg} />
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * A série escrita por extenso ("60 kg × 8"), para o leitor de tela, ou
 * curta ("60 × 8"), para a grade: com a unidade em cada célula, "107,5 kg ×
 * 10" não cabia na coluna em 390px e era cortado (visto vermelho). A unidade
 * vai uma vez no cabeçalho.
 */
function target(value: SetTarget, short = false): string {
  if (value.durationSeconds !== null && value.reps === null && value.weightKg === null) {
    return `${formatDecimal(value.durationSeconds / 60)} min`;
  }
  const load = value.weightKg === null ? "—" : short ? formatDecimal(value.weightKg) : kg(value.weightKg);
  return value.reps === null ? load : `${load} × ${String(value.reps)}`;
}

function ExerciseDetail({ name, sets, deltaKg }: { readonly name: string; readonly sets: readonly SessionSet[]; readonly deltaKg: number | null }) {
  const missing = sets.filter((set) => set.done === null).length;
  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h4 className="font-medium break-words text-ink">{name}</h4>
        <p className="text-xs">
          {deltaKg === null ? null : deltaKg === 0 ? (
            <span className="text-ink-subtle">Mesma carga da última vez</span>
          ) : (
            <span className={deltaKg > 0 ? "text-accent-text" : "text-warning-text"}>
              {deltaKg > 0 ? "+" : "−"}
              {kg(Math.abs(deltaKg))} desde a última vez
            </span>
          )}
          {missing > 0 && (
            <span className="text-warning-text">
              {deltaKg === null ? "" : " · "}
              {missing === 1 ? "1 série não feita" : `${String(missing)} séries não feitas`}
            </span>
          )}
        </p>
      </div>
      {/* Uma grade só para cabeçalho e séries, como o editor de treino. */}
      {/* Colunas com teto: em tela larga, com "1fr", prescrito e feito
          ficavam a centenas de pixels um do outro (visto na captura). */}
      <div style={{ "--set-cols": "2rem minmax(0, 8rem) minmax(0, 8rem) 2.5rem", "--set-gap": "12px" } as React.CSSProperties} className="mt-2">
        <div aria-hidden className="set-grid items-end border-b border-line pb-1 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase">
          <span>Série</span>
          <span>Prescrito</span>
          <span>Feito</span>
          <span>RPE</span>
        </div>
        <p aria-hidden className="mt-1 text-[0.6875rem] text-ink-subtle">kg × repetições</p>
        <ol>
          {sets.map((set, index) => {
            const label = `Série ${String(index + 1)}${set.warmup ? ", aquecimento" : ""}: prescrito ${set.planned === null ? "sem meta" : target(set.planned)}, ${set.done === null ? "não feita" : `feito ${target(set.done)}, RPE ${set.done.rpe === null ? "sem registro" : formatDecimal(set.done.rpe)}`}`;
            return (
              // As séries não reordenam: o índice é estável.
              <li key={index} aria-label={label} className="set-grid min-h-8 items-center border-b border-line text-sm tabular-nums last:border-b-0">
                <span aria-hidden className="text-ink-subtle">
                  {set.warmup ? "A" : index + 1}
                </span>
                <span aria-hidden className="break-words text-ink-subtle">{set.planned === null ? "—" : target(set.planned, true)}</span>
                <span aria-hidden className={cn("break-words", set.done === null ? "text-warning-text" : "text-ink")}>
                  {set.done === null ? "Não feita" : target(set.done, true)}
                </span>
                <span aria-hidden className="text-ink-muted">{set.done?.rpe == null ? "—" : formatDecimal(set.done.rpe)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Diário
// ---------------------------------------------------------------------------

const MEAL_STATE: Record<MealDayState | "planned", { readonly icon: typeof CircleCheck; readonly label: string; readonly className: string }> = {
  checked: { icon: CircleCheck, label: "Feito", className: "font-medium text-accent-text" },
  edited: { icon: CircleDot, label: "Fora do plano", className: "text-ink" },
  unchecked: { icon: Minus, label: "Sem registro", className: "text-ink-subtle" },
  planned: { icon: Clock, label: "Planejado", className: "text-ink-subtle" },
};

export function PatientDiary({ linkId, plan }: { readonly linkId: string; readonly plan: PlanSummary | null }) {
  const repository = useFollowUpRepository();
  const [today] = useState(() => dayKey(new Date()));
  const [start, setStart] = useState(() => weekStart(today));
  const published = plan?.versions[0];
  const load = useCallback(
    () => repository.listDiary(linkId, start, shiftDay(start, 6), plan === null || published === undefined ? null : { id: plan.id, meals: published.meals }),
    [repository, linkId, start, plan, published],
  );
  const state = useFollowUp(load);
  const days = Array.from({ length: 7 }, (_, index) => shiftDay(start, index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">
          Semana de {shortDay(days[0]!)} a {shortDay(days[6]!)}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => {
              setStart((current) => shiftDay(current, -7));
            }}
            className="flex size-11 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 ease-out hover:bg-muted"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Próxima semana"
            disabled={start >= weekStart(today)}
            onClick={() => {
              setStart((current) => shiftDay(current, 7));
            }}
            className="flex size-11 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 ease-out hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <Loading state={state} what="o diário">
        {state.status === "ready" && <DiaryTable week={state.value} days={days} today={today} />}
      </Loading>
    </div>
  );
}

function DiaryTable({ week, days, today }: { readonly week: DiaryWeek; readonly days: readonly string[]; readonly today: string }) {
  const byDay = new Map(week.days.map((day) => [day.day, day]));
  const legend = (["checked", "edited", "unchecked", "planned"] as const).map((key) => <MealState key={key} state={key} />);

  return (
    <>
      {week.planMeals.length > 0 && <div className="flex flex-wrap gap-x-5 gap-y-2">{legend}</div>}
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-40" />
            {days.map((day) => (
              <col key={day} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-line text-left text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase">
              <th scope="col" className="h-9 px-4">
                {week.planMeals.length > 0 ? "Refeição" : "Dia"}
              </th>
              {days.map((day) => (
                <th key={day} scope="col" className={cn("h-9 px-2", day === today && "text-accent-text")}>
                  {WEEKDAY_SHORT_LABELS[weekdayKey(day)]} {day.slice(8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.planMeals.map((meal) => (
              <tr key={meal.id} className="border-b border-line">
                <th scope="row" className="h-11 truncate px-4 text-left font-medium text-ink">
                  {meal.name}
                </th>
                {days.map((day) => {
                  const record = byDay.get(day);
                  const state: MealDayState | "planned" | "own" =
                    record?.ownDiet === true ? "own" : (record?.meals[meal.id] ?? (day > today ? "planned" : "unchecked"));
                  return (
                    <td key={day} className="h-11 px-2">
                      {state === "own" ? <span className="text-xs text-ink-subtle">Dieta própria</span> : <MealState state={state === "unchecked" && day > today ? "planned" : state} />}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row" className="h-11 px-4 text-left font-medium text-ink">
                Total comido
              </th>
              {days.map((day) => {
                const record = byDay.get(day);
                return (
                  <td key={day} className="h-11 px-2 text-ink-muted tabular-nums">
                    {record === undefined ? "—" : `${formatDecimal(record.eatenKcal, 0)} kcal`}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-subtle">
        {week.planMeals.length > 0
          ? "Conta só o que o paciente registrou, não confirma o que foi comido. \"Dieta própria\" é um dia em que o paciente seguiu uma dieta dele no lugar do plano."
          : "Sem plano publicado, o diário aparece pelo total de cada dia."}
      </p>
    </>
  );
}

function weekdayKey(day: string) {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[new Date(`${day}T12:00:00`).getDay()]!;
}

function MealState({ state }: { readonly state: MealDayState | "planned" }) {
  const { icon: Icon, label, className } = MEAL_STATE[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Evolução
// ---------------------------------------------------------------------------

export function PatientBody({ linkId }: { readonly linkId: string }) {
  const repository = useFollowUpRepository();
  const load = useCallback(() => repository.listBody(linkId), [repository, linkId]);
  const state = useFollowUp(load);

  return (
    <Loading state={state} what="a evolução física">
      {state.status === "ready" && <Body points={state.value} />}
    </Loading>
  );
}

function Body({ points }: { readonly points: readonly BodyPoint[] }) {
  const weights = points.flatMap((point) => (point.weightKg === null ? [] : [{ day: point.day, value: point.weightKg }]));
  const first = weights[0];
  const last = weights.at(-1);
  const withMeasures = points.filter((point) => point.measurements.length > 0);
  const before = withMeasures[0];
  const after = withMeasures.at(-1);
  const sites = after?.measurements ?? [];

  if (weights.length === 0 && withMeasures.length === 0) {
    return <p className="rounded-lg border border-line bg-surface p-5 text-sm text-ink-muted">Nenhum peso ou medida registrado ainda.</p>;
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      {last !== undefined && first !== undefined && (
        <Card className="min-w-0">
          <Metric
            value={formatDecimal(last.value)}
            unit="kg"
            label={
              weights.length > 1
                ? `Peso · ${formatDecimal(Math.abs(last.value - first.value))} kg ${last.value <= first.value ? "a menos" : "a mais"} desde ${shortDay(first.day)}`
                : `Peso em ${shortDay(last.day)}`
            }
          />
          <div className="mt-4">
            <TrendChart points={weights} average={[]} unit="kg" label="Peso ao longo do tempo" />
          </div>
        </Card>
      )}
      {before !== undefined && after !== undefined && (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[20rem] table-fixed border-collapse text-sm">
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-20" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase">
                <th scope="col" className="h-9 px-4">Medida (cm)</th>
                <th scope="col" className="h-9 px-2 text-right">{shortDay(before.day)}</th>
                <th scope="col" className="h-9 px-2 text-right">{shortDay(after.day)}</th>
                <th scope="col" className="h-9 px-4 text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const from = before.measurements.find((measure) => measure.site === site.site)?.cm;
                const change = from === undefined ? null : site.cm - from;
                return (
                  <tr key={site.site} className="border-b border-line last:border-b-0">
                    <th scope="row" className="h-11 px-4 text-left font-medium text-ink">{site.label}</th>
                    <td className="h-11 px-2 text-right text-ink-subtle tabular-nums">{from === undefined ? "—" : formatDecimal(from)}</td>
                    <td className="h-11 px-2 text-right text-ink tabular-nums">{formatDecimal(site.cm)}</td>
                    <td className="h-11 px-4 text-right text-ink-muted tabular-nums">
                      {change === null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : ""}${formatDecimal(Math.abs(change))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-3 text-xs text-ink-subtle">Fotos de progresso não são compartilhadas.</p>
        </div>
      )}
    </div>
  );
}
