"use client";

import { useState } from "react";

import { parseDecimal } from "@/core/format/decimal";
import {
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  BIOLOGICAL_SEXES,
  GOAL_LABELS,
  GOALS,
  nutritionProfileSchema,
  SEX_LABELS,
  type NutritionProfile,
} from "@/core/nutrition";
import { Button } from "@/design-system/components/button";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";

interface Props {
  readonly initial: NutritionProfile | null;
  readonly pending: boolean;
  readonly onSubmit: (profile: NutritionProfile) => void;
}

type Draft = {
  sex: NutritionProfile["sex"];
  activityLevel: NutritionProfile["activityLevel"];
  goal: NutritionProfile["goal"];
  ageYears: string;
  heightCm: string;
  weightKg: string;
  bodyFatPercent: string;
  weeklyChangeKg: string;
};

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink transition-[border-color] duration-150 ease-out hover:border-line-strong";

export function ProfileForm({ initial, pending, onSubmit }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [issues, setIssues] = useState<Readonly<Record<string, string>>>({});

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const bodyFat = parseDecimal(draft.bodyFatPercent);
    const weekly = parseDecimal(draft.weeklyChangeKg);

    const parsed = nutritionProfileSchema.safeParse({
      sex: draft.sex,
      activityLevel: draft.activityLevel,
      goal: draft.goal,
      ageYears: parseDecimal(draft.ageYears) ?? Number.NaN,
      heightCm: parseDecimal(draft.heightCm) ?? Number.NaN,
      weightKg: parseDecimal(draft.weightKg) ?? Number.NaN,
      // Omitted rather than sent as undefined: these are genuinely optional,
      // and an absent key is not the same as a blank answer.
      ...(bodyFat === null ? {} : { bodyFatPercent: bodyFat }),
      ...(weekly === null ? {} : { weeklyChangeKg: weekly }),
    });

    if (!parsed.success) {
      const collected: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        collected[path] ??= issue.message;
      }
      setIssues(collected);
      return;
    }

    setIssues({});
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sexo" id="sex">
          {({ id }) => (
            <select
              id={id}
              value={draft.sex}
              onChange={(event) => {
                update("sex", event.target.value as Draft["sex"]);
              }}
              className={SELECT_CLASS}
            >
              {BIOLOGICAL_SEXES.map((sex) => (
                <option key={sex} value={sex}>
                  {SEX_LABELS[sex]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Idade" id="ageYears" error={issues["ageYears"]}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              inputMode="numeric"
              value={draft.ageYears}
              onChange={(event) => {
                update("ageYears", event.target.value);
              }}
              placeholder="—"
            />
          )}
        </Field>

        <Field label="Altura (cm)" id="heightCm" error={issues["heightCm"]}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              inputMode="decimal"
              value={draft.heightCm}
              onChange={(event) => {
                update("heightCm", event.target.value);
              }}
              placeholder="—"
            />
          )}
        </Field>

        <Field label="Peso (kg)" id="weightKg" error={issues["weightKg"]}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              inputMode="decimal"
              value={draft.weightKg}
              onChange={(event) => {
                update("weightKg", event.target.value);
              }}
              placeholder="—"
            />
          )}
        </Field>
      </div>

      <Field label="Nível de atividade" id="activityLevel">
        {({ id }) => (
          <select
            id={id}
            value={draft.activityLevel}
            onChange={(event) => {
              update(
                "activityLevel",
                event.target.value as Draft["activityLevel"],
              );
            }}
            className={SELECT_CLASS}
          >
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {ACTIVITY_LABELS[level]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Objetivo" id="goal">
        {({ id }) => (
          <select
            id={id}
            value={draft.goal}
            onChange={(event) => {
              update("goal", event.target.value as Draft["goal"]);
            }}
            className={SELECT_CLASS}
          >
            {GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {GOAL_LABELS[goal]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Gordura corporal (%)"
          id="bodyFatPercent"
          error={issues["bodyFatPercent"]}
          hint="Opcional. Melhora bastante a estimativa."
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              inputMode="decimal"
              value={draft.bodyFatPercent}
              onChange={(event) => {
                update("bodyFatPercent", event.target.value);
              }}
              placeholder="—"
            />
          )}
        </Field>

        <Field
          label="Ritmo (kg/semana)"
          id="weeklyChangeKg"
          error={issues["weeklyChangeKg"]}
          hint="Opcional. É limitado ao que for sustentável."
          disabled={draft.goal === "maintain"}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              inputMode="decimal"
              disabled={draft.goal === "maintain"}
              value={draft.goal === "maintain" ? "" : draft.weeklyChangeKg}
              onChange={(event) => {
                update("weeklyChangeKg", event.target.value);
              }}
              placeholder="—"
            />
          )}
        </Field>
      </div>

      <Button type="submit" size="lg" pending={pending}>
        Calcular metas
      </Button>
    </form>
  );
}

function toDraft(initial: NutritionProfile | null): Draft {
  const text = (value: number | undefined) =>
    value === undefined ? "" : String(value);

  return {
    sex: initial?.sex ?? "male",
    activityLevel: initial?.activityLevel ?? "moderate",
    goal: initial?.goal ?? "maintain",
    ageYears: text(initial?.ageYears),
    heightCm: text(initial?.heightCm),
    weightKg: text(initial?.weightKg),
    bodyFatPercent: text(initial?.bodyFatPercent),
    weeklyChangeKg: text(initial?.weeklyChangeKg),
  };
}
