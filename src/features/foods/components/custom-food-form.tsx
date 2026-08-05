"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";

import { useCreateFood } from "../hooks/use-create-food";
import { estimateKcal } from "../services/create-food";
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from "../types/food";
import { customFoodSchema } from "../validation/food-schema";
import { Field } from "./field";
import { parseDecimal } from "./parse-decimal";

const MACROS = [
  { key: "proteinG", label: "Proteína" },
  { key: "carbsG", label: "Carboidrato" },
  { key: "fatG", label: "Gordura" },
] as const;

type NumericKey = "kcal" | "proteinG" | "carbsG" | "fatG";
type Draft = Record<"name" | NumericKey, string> & {
  category: (typeof FOOD_CATEGORIES)[number];
};

const EMPTY: Draft = {
  name: "",
  category: "protein",
  kcal: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
};

export function CustomFoodForm() {
  const router = useRouter();
  const { save, pending, error } = useCreateFood();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [issues, setIssues] = useState<Readonly<Record<string, string>>>({});

  function update(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const proteinG = parseDecimal(draft.proteinG);
  const carbsG = parseDecimal(draft.carbsG);
  const fatG = parseDecimal(draft.fatG);

  const suggestion =
    proteinG !== null && carbsG !== null && fatG !== null
      ? estimateKcal({ proteinG, carbsG, fatG })
      : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // `NaN` for a blank field rather than skipping it, so the schema reports
    // the missing value instead of the form silently submitting a zero.
    const parsed = customFoodSchema.safeParse({
      name: draft.name,
      category: draft.category,
      per100g: {
        kcal: parseDecimal(draft.kcal) ?? Number.NaN,
        proteinG: proteinG ?? Number.NaN,
        carbsG: carbsG ?? Number.NaN,
        fatG: fatG ?? Number.NaN,
      },
    });

    if (!parsed.success) {
      setIssues(collectIssues(parsed.error.issues));
      return;
    }

    setIssues({});
    if (await save(parsed.data)) router.push("/alimentos");
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="space-y-5"
    >
      <Field label="Nome" id="name" error={issues["name"]}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={draft.name}
            onChange={(event) => {
              update("name", event.target.value);
            }}
            placeholder="Whey protein da marca X"
            autoComplete="off"
          />
        )}
      </Field>

      <Field label="Categoria" id="category">
        {({ id }) => (
          <select
            id={id}
            value={draft.category}
            onChange={(event) => {
              update("category", event.target.value);
            }}
            className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink transition-[border-color] duration-150 ease-out hover:border-line-strong"
          >
            {FOOD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {FOOD_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-ink">
          Por 100 g <span className="text-ink-subtle">— como está no rótulo</span>
        </legend>

        <div className="grid grid-cols-3 gap-3">
          {MACROS.map((macro) => (
            <Field
              key={macro.key}
              label={macro.label}
              id={macro.key}
              error={issues[`per100g.${macro.key}`]}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  inputMode="decimal"
                  value={draft[macro.key]}
                  onChange={(event) => {
                    update(macro.key, event.target.value);
                  }}
                  placeholder="0"
                />
              )}
            </Field>
          ))}
        </div>

        <Field
          label="Calorias"
          id="kcal"
          error={issues["per100g.kcal"] ?? issues["per100g"]}
          hint={
            suggestion === null
              ? "Copie do rótulo."
              : `Pelos macros daria ~${suggestion} kcal, mas fibra derruba esse número. O rótulo tem prioridade.`
          }
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              inputMode="decimal"
              value={draft.kcal}
              onChange={(event) => {
                update("kcal", event.target.value);
              }}
              placeholder="0"
            />
          )}
        </Field>
      </fieldset>

      {error !== null && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink"
        >
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" pending={pending}>
          Salvar alimento
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => {
            router.push("/alimentos");
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/**
 * One message per field path, first wins: three complaints about the same
 * input at once is noise.
 */
function collectIssues(
  zodIssues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const issues: Record<string, string> = {};

  for (const issue of zodIssues) {
    const path = issue.path.join(".");
    issues[path] ??= issue.message;
  }

  return issues;
}
