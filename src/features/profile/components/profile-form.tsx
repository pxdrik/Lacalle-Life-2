"use client";

import { useState } from "react";

import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import {
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  BIOLOGICAL_SEXES,
  GOAL_LABELS,
  GOALS,
  nutritionProfileSchema,
  SEX_LABELS,
  weeklyRatePresets,
  type NutritionProfile,
} from "@/core/nutrition";
import { Button } from "@/design-system/components/button";
import { cn } from "@/design-system/cn";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Section } from "@/design-system/components/section";
import { Select } from "@/design-system/components/select";

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
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Sprint 8: the form used to read as one corrida block of fields —
          it now groups by what each part is *for*, which was already true
          of the data (identidade vs. objetivo vs. nutrição) and just was not
          said out loud. Nothing about validation, submission or the fields
          themselves changed — only the labels around them. */}
      <Section title="Identidade" size="compact">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sexo" id="sex">
            {({ id }) => (
              <Select
                id={id}
                value={draft.sex}
                onChange={(event) => {
                  update("sex", event.target.value as Draft["sex"]);
                }}
              >
                {BIOLOGICAL_SEXES.map((sex) => (
                  <option key={sex} value={sex}>
                    {SEX_LABELS[sex]}
                  </option>
                ))}
              </Select>
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
      </Section>

      <Section title="Objetivo" size="compact">
        <div className="space-y-3">
          <Field label="Nível de atividade" id="activityLevel">
            {({ id }) => (
              <Select
                id={id}
                value={draft.activityLevel}
                onChange={(event) => {
                  update(
                    "activityLevel",
                    event.target.value as Draft["activityLevel"],
                  );
                }}
              >
                {ACTIVITY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {ACTIVITY_LABELS[level]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Objetivo" id="goal">
            {({ id }) => (
              <Select
                id={id}
                value={draft.goal}
                onChange={(event) => {
                  update("goal", event.target.value as Draft["goal"]);
                }}
              >
                {GOALS.map((goal) => (
                  <option key={goal} value={goal}>
                    {GOAL_LABELS[goal]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Nutrição" size="compact">
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

        {/* Presets derived from the same percentage-of-bodyweight limits the
            engine enforces (`weeklyRatePresets`), not fixed kilograms — a
            fixed "1 kg/semana" preset is unsafe for a 60 kg person and
            pointless for a 120 kg one. The free field above still takes any
            value in between or outside these two; this only offers a
            starting point for someone who has no idea what "sustainable"
            means in kilograms. */}
        {draft.goal !== "maintain" && (
          <RatePresetChips
            goal={draft.goal}
            weightKg={parseDecimal(draft.weightKg)}
            value={draft.weeklyChangeKg}
            onChange={(value) => {
              update("weeklyChangeKg", value);
            }}
          />
        )}
      </Section>

      <Button type="submit" size="lg" pending={pending}>
        Calcular metas
      </Button>
    </form>
  );
}

function RatePresetChips({
  goal,
  weightKg,
  value,
  onChange,
}: {
  readonly goal: Exclude<NutritionProfile["goal"], "maintain">;
  readonly weightKg: number | null;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  if (weightKg === null || weightKg <= 0) return null;

  const presets = weeklyRatePresets(weightKg, goal);
  const selected = parseDecimal(value);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {presets.map((preset) => {
        const active = selected !== null && selected === preset.weeklyChangeKg;

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              onChange(String(preset.weeklyChangeKg));
            }}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs tabular-nums transition-colors duration-150 ease-out",
              active
                ? "border-accent bg-accent/10 text-accent-text"
                : "border-line-strong text-ink-muted hover:border-accent hover:text-ink",
            )}
          >
            {preset.label} ({formatDecimal(preset.weeklyChangeKg, 2)} kg)
          </button>
        );
      })}
    </div>
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
