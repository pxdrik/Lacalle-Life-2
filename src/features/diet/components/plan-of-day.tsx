"use client";

import { ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Card } from "@/design-system/components/card";
import { Dialog } from "@/design-system/components/dialog";
import { useToast } from "@/design-system/components/toast";

import { mealMacros } from "../services/diet-macros";
import { WEEKDAY_SHORT_LABELS, type Weekday } from "../services/diet-schedule";
import { currentOption, type MealOption, mealOptions } from "../services/plan-option";
import type { Meal } from "../types/diet";
import type { PrescribedPlan } from "../types/prescribed-plan";
import { MacroSummary } from "./macro-summary";

/**
 * No Diário, de onde vem o dia (estudo do paciente, 30/09/2026): o plano da
 * nutricionista, separado de uma dieta da própria pessoa.
 */
export function PlanOfDay({ plan }: { readonly plan: PrescribedPlan }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg bg-accent-surface px-3 py-2 text-sm text-ink-muted">
      <ClipboardList aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
      <span className="min-w-0 break-words">
        Plano de hoje: <span className="font-medium text-ink">{plan.name}</span>, de {plan.professionalName}
      </span>
    </p>
  );
}

/**
 * Quando a dieta da própria pessoa toma o dia de um plano (a regra que o
 * Pedro escolheu), o Diário diz isso e mostra onde o plano vale, em vez de
 * o plano simplesmente não aparecer.
 */
export function PlanBehindOwnDiet({
  plan,
  dietName,
  planDays,
}: {
  readonly plan: PrescribedPlan;
  readonly dietName: string;
  /** Os dias em que o plano vale de fato (`planDays`). */
  readonly planDays: readonly Weekday[];
}) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-ink-muted">
      <ClipboardList aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
      <span className="min-w-0 break-words">
        Hoje vale a sua dieta <span className="font-medium text-ink">{dietName}</span>.{" "}
        {planDays.length === 0
          ? `O plano de ${plan.professionalName} está sem dias, porque todos são das suas dietas.`
          : `O plano de ${plan.professionalName} vale em ${planDays.map((day) => WEEKDAY_SHORT_LABELS[day]).join(", ")}.`}{" "}
        <Link href="/dietas" className="inline-flex min-h-11 items-center font-medium text-accent-text underline-offset-4 hover:underline">
          Mudar os dias em Dietas
        </Link>
      </span>
    </p>
  );
}

/**
 * "Opção de hoje": numa refeição do plano com outras opções, a pessoa
 * escolhe qual vai comer neste dia. Só aparece antes de marcar a refeição
 * como comida: trocar depois apagaria o que foi registrado.
 */
export function TodayOption({
  meal,
  planMeal,
  onChoose,
}: {
  /** A refeição no Diário. */
  readonly meal: Meal;
  /** A mesma refeição no plano, com as opções. */
  readonly planMeal: Meal;
  readonly onChoose: (option: MealOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const options = mealOptions(planMeal);
  const current = currentOption(meal, options);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 text-left text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted"
      >
        <span className="min-w-0 break-words">
          {meal.name}, opção de hoje: <span className="font-medium text-ink">{current?.name ?? "ajustada"}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0" />
      </button>
      <Dialog
        open={open}
        title={`${meal.name} de hoje`}
        onClose={() => {
          setOpen(false);
        }}
        placement="sheet-bottom"
      >
        <p className="text-sm text-ink-muted">Escolha o que você vai comer hoje. Só o dia de hoje muda; o plano continua igual.</p>
        <ul className="mt-4 space-y-2">
          {options.map((option) => {
            const selected = option.id === current?.id;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onChoose(option);
                    setOpen(false);
                    toast(`${meal.name} de hoje: ${option.name}. O plano não muda.`);
                  }}
                  className="block w-full text-left"
                >
                  <Card className={cn("space-y-1.5 transition-colors duration-150 ease-out", selected && "border-accent bg-accent-surface")}>
                    <span className="block font-medium break-words text-ink">{option.name}</span>
                    <span className="block text-xs break-words text-ink-subtle">
                      {option.items.map((item) => item.name).join(", ")}
                    </span>
                    <MacroSummary macros={mealMacros({ ...planMeal, items: option.items })} />
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}
