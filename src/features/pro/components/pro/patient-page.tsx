"use client";

import { ArrowLeft, ClipboardList, Dumbbell, Plus, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Badge } from "@/design-system/components/badge";
import { buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { noticeClasses } from "@/design-system/components/notice";
import { PageHeader } from "@/design-system/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";

import { describeWeekdays, type Weekday } from "@/core/domain/weekday";

import { usePatientPlans } from "../../hooks/use-patient-plans";
import { usePatientRoutines } from "../../hooks/use-patient-routines";
import { usePatients } from "../../hooks/use-patients";
import { describeSharing, type PatientLink } from "../../types/care";
import type { PlanSummary } from "../../types/plan";
import type { RoutineSummary } from "../../types/routine";

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatDate = (iso: string) => DATE.format(new Date(iso));

/**
 * Um paciente no Life Pro (protótipo v3): o plano alimentar e os treinos
 * (Etapa 8, protótipo de 01/10/2026), com as versões publicadas. Diário e Evolução entram com a Etapa 6, quando houver dado real
 * para mostrar (nada de aba de mentira).
 */
export function PatientPage({ linkId }: { readonly linkId: string }) {
  const patients = usePatients();

  const back = (
    <Link
      href="/pro/pacientes"
      className="inline-flex h-8 items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Pacientes
    </Link>
  );

  if (patients.state.status === "loading") {
    return (
      <>
        {back}
        <Skeleton className="mt-4 h-48" />
      </>
    );
  }

  const link = patients.state.status === "ready" ? patients.state.links.find((item) => item.id === linkId) : undefined;
  if (link === undefined) {
    return (
      <>
        {back}
        <div role="alert" className={cn(noticeClasses("danger", "block"), "mt-4")}>
          <p className="text-ink">
            {patients.state.status === "error" ? "Não foi possível carregar o paciente." : "Este paciente não está na sua lista."}
          </p>
          <p className="mt-1.5 text-sm text-ink-muted">Volte para Pacientes e abra de novo.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {back}
      <PageHeader
        icon={Users}
        title={link.label}
        subtitle={
          link.status === "active"
            ? `Vê: ${describeSharing(link.sharing)} · desde ${formatDate(link.createdAt)}`
            : `Vínculo encerrado em ${formatDate(link.endedAt ?? link.createdAt)}`
        }
        className="mt-4"
      >
        <Badge state={link.status === "active" ? "concluido" : "neutro"}>
          {link.status === "active" ? "Ativo" : "Encerrado"}
        </Badge>
      </PageHeader>
      <Plans link={link} />
      <Routines link={link} />
    </>
  );
}

function Plans({ link }: { readonly link: PatientLink }) {
  const { state, createPlan } = usePatientPlans(link.id);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const active = link.status === "active";

  const create = () => {
    setCreating(true);
    setCreateError(false);
    createPlan("Plano alimentar")
      .then((planId) => {
        router.push(editorHref(link.id, planId));
      })
      .catch(() => {
        setCreating(false);
        setCreateError(true);
      });
  };

  return (
    <section aria-labelledby="plano" className="mt-8 space-y-4">
      <h2 id="plano" className="text-lg font-semibold text-ink">
        Plano alimentar
      </h2>

      {state.status === "loading" && <Skeleton className="h-32" />}
      {state.status === "error" && (
        <div role="alert" className={noticeClasses("danger", "block")}>
          <p className="text-ink">Não foi possível carregar o plano.</p>
          <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e recarregue a página.</p>
        </div>
      )}
      {createError && (
        <div role="alert" className={noticeClasses("danger", "block")}>
          <p className="text-ink">Não foi possível criar o plano. Confira a conexão e tente de novo.</p>
        </div>
      )}
      {state.status === "ready" &&
        (state.plans.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhum plano ainda."
            caption={
              active
                ? "Monte as refeições com os alimentos do app. O paciente só vê depois que você publicar."
                : "Com o vínculo encerrado, não dá para publicar planos."
            }
            action={active && !creating ? { label: "Criar plano alimentar", onClick: create, icon: Plus } : undefined}
          />
        ) : (
          state.plans.map((plan) => <PlanCard key={plan.id} plan={plan} link={link} />)
        ))}
    </section>
  );
}

function PlanCard({ plan, link }: { readonly plan: PlanSummary; readonly link: PatientLink }) {
  const [current] = plan.versions;
  return (
    <>
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium break-words text-ink">{plan.name}</span>
            {plan.hasDraft && <Badge state="atencao">Rascunho</Badge>}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {current === undefined
              ? "Ainda não publicado. O paciente não vê nada até você publicar."
              : `Versão ${String(current.version)}, publicada em ${formatDate(current.publishedAt)}.${
                  plan.hasDraft ? ` O paciente vê esta versão até você publicar a próxima.` : ""
                }`}
          </p>
        </div>
        {link.status === "active" && (
          <Link href={editorHref(link.id, plan.id)} className={buttonClasses("primary", "md")}>
            Editar plano
          </Link>
        )}
      </Card>

      {plan.versions.length > 0 && (
        <section aria-label={`Versões de ${plan.name}`}>
          <h3 className="mb-3 text-sm font-semibold text-ink">Versões publicadas</h3>
          <ul className="overflow-hidden rounded-lg border border-line bg-surface">
            {plan.versions.map((version) => (
              <li
                key={version.version}
                className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4 md:px-5"
              >
                <span className="shrink-0 font-medium text-ink">Versão {version.version}</span>
                <span className="shrink-0 text-sm text-ink-subtle">{formatDate(version.publishedAt)}</span>
                <span className="min-w-0 text-sm break-words text-ink-muted">
                  {version.changeNote === "" ? "Sem nota." : version.changeNote}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-subtle">
            Versões publicadas não mudam. Editar cria um rascunho novo, e o paciente continua vendo a versão atual até
            você publicar.
          </p>
        </section>
      )}
    </>
  );
}

export function editorHref(linkId: string, planId: string): Route {
  return `/pro/pacientes/${linkId}/plano/${planId}` as Route;
}

/** Sem dias, o paciente faz quando quiser (0038). */
const routineDays = (days: readonly Weekday[]) => (days.length === 0 ? "Quando quiser" : describeWeekdays(days));

function Routines({ link }: { readonly link: PatientLink }) {
  const { state, createRoutine } = usePatientRoutines(link.id);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const active = link.status === "active";

  const create = () => {
    setCreating(true);
    setCreateError(false);
    const count = state.status === "ready" ? state.routines.length : 0;
    createRoutine(`Treino ${String.fromCharCode(65 + Math.min(count, 25))}`)
      .then((routineId) => {
        router.push(routineEditorHref(link.id, routineId));
      })
      .catch(() => {
        setCreating(false);
        setCreateError(true);
      });
  };

  return (
    <section aria-labelledby="treino" className="mt-10 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="treino" className="text-lg font-semibold text-ink">
          Treino
        </h2>
        {active && state.status === "ready" && state.routines.length > 0 && (
          <button
            type="button"
            disabled={creating}
            onClick={create}
            className={buttonClasses("secondary", "sm")}
          >
            <Plus aria-hidden className="size-4" />
            Novo treino
          </button>
        )}
      </div>

      {state.status === "loading" && <Skeleton className="h-32" />}
      {state.status === "error" && (
        <div role="alert" className={noticeClasses("danger", "block")}>
          <p className="text-ink">Não foi possível carregar os treinos.</p>
          <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e recarregue a página.</p>
        </div>
      )}
      {createError && (
        <div role="alert" className={noticeClasses("danger", "block")}>
          <p className="text-ink">Não foi possível criar o treino. Confira a conexão e tente de novo.</p>
        </div>
      )}
      {state.status === "ready" &&
        (state.routines.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="Nenhum treino ainda."
            caption={
              active
                ? "Monte a rotina com os exercícios do catálogo do app. Para A, B e C, crie um treino para cada. O paciente só vê depois que você publicar."
                : "Com o vínculo encerrado, não dá para publicar treinos."
            }
            action={active && !creating ? { label: "Criar treino", onClick: create, icon: Plus } : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {state.routines.map((routine) => (
              <RoutineCard key={routine.id} routine={routine} link={link} />
            ))}
          </ul>
        ))}
    </section>
  );
}

function RoutineCard({ routine, link }: { readonly routine: RoutineSummary; readonly link: PatientLink }) {
  const [current] = routine.versions;
  return (
    <li>
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium break-words text-ink">{routine.name}</span>
            {routine.hasDraft && <Badge state="atencao">Rascunho</Badge>}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {current === undefined
              ? "Ainda não publicado. O paciente não vê nada até você publicar."
              : `Versão ${String(current.version)}, publicada em ${formatDate(current.publishedAt)} · ${routineDays(current.weekdays)}.${
                  routine.hasDraft ? " O paciente vê esta versão até você publicar a próxima." : ""
                }`}
          </p>
        </div>
        {link.status === "active" && (
          <Link href={routineEditorHref(link.id, routine.id)} className={buttonClasses("primary", "md")}>
            Editar treino
          </Link>
        )}
      </Card>
    </li>
  );
}

export function routineEditorHref(linkId: string, routineId: string): Route {
  return `/pro/pacientes/${linkId}/treino/${routineId}` as Route;
}
