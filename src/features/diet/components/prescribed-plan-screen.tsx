"use client";

import { ArrowLeft, Copy, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { cn } from "@/design-system/cn";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";
import { useToast } from "@/design-system/components/toast";

import { useOptionalPrescribedPlanRepository } from "../data/prescribed-plan-repository-context";
import { useDietList } from "../hooks/use-diet-list";
import { usePrescribedPlans } from "../hooks/use-prescribed-plans";
import { dietMacros } from "../services/diet-macros";
import { planAsDiet } from "../services/prescribed-plan";
import { MacroSummary } from "./macro-summary";
import { PrescribedMealCard } from "./prescribed-meal-card";

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * O plano da nutricionista, aberto para leitura (estudo aprovado em
 * 30/09/2026). Só ela altera; para mudar algo por conta própria, a pessoa
 * faz uma cópia, que vira uma dieta dela. Abrir marca a versão como vista,
 * e é isso que apaga o "Atualizado" de Dietas.
 */
export function PrescribedPlanScreen({ planId }: { readonly planId: string }) {
  const state = usePrescribedPlans();
  const repository = useOptionalPrescribedPlanRepository();
  const { duplicate, writeError } = useDietList();
  const toast = useToast();
  const plan = state.status === "ready" ? state.plans.find((item) => item.id === planId) : undefined;
  const version = plan?.version;

  useEffect(() => {
    if (repository === null || version === undefined) return;
    void repository.then((repo) => repo.markSeen(planId, version)).catch(() => undefined);
  }, [repository, planId, version]);

  const back = (
    <Link
      href="/dietas"
      className="inline-flex h-8 items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Dietas
    </Link>
  );

  if (state.status === "loading") {
    return (
      <>
        {back}
        <Skeleton className="mt-4 h-64" />
      </>
    );
  }

  if (plan === undefined) {
    return (
      <>
        {back}
        <div role="alert" className={cn(noticeClasses("danger", "block"), "mt-4")}>
          <p className="text-ink">Este plano não está neste aparelho.</p>
          <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e abra Dietas de novo.</p>
        </div>
      </>
    );
  }

  const diet = planAsDiet(plan);

  return (
    <>
      {back}
      <header className="mt-4">
        <h1 className="text-h2 font-bold break-words text-balance md:text-h1">{plan.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Badge state="concluido">Profissional</Badge>
          {plan.professionalName} · versão {plan.version}, {DATE.format(new Date(plan.publishedAt))}
        </p>
      </header>

      {plan.linkEnded && (
        <p className={cn(noticeClasses("info"), "mt-4")}>
          O acompanhamento terminou. O plano continua aqui, sem versões novas.
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {plan.meals.map((meal) => (
          <PrescribedMealCard key={meal.id} meal={meal} professionalName={plan.professionalName} />
        ))}
      </ul>

      <Card className="mt-3 space-y-2">
        <p className="text-sm text-ink-muted">Total do dia</p>
        <MacroSummary macros={dietMacros(diet)} size="lg" />
      </Card>

      <p className={cn(noticeClasses("info"), "mt-4 flex gap-2")}>
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          Só {plan.professionalName} altera este plano. Para mudar algo por conta própria, faça uma cópia: ela vira uma
          dieta sua.
        </span>
      </p>
      {writeError !== null && (
        <p role="alert" className={cn(noticeClasses(), "mt-3")}>
          {writeError}
        </p>
      )}
      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => {
          void duplicate(diet).then((copied) => {
            if (copied) toast("Cópia criada em Suas dietas.");
          });
        }}
      >
        <Copy aria-hidden className="size-4" />
        Fazer uma cópia
      </Button>
    </>
  );
}
