"use client";

import { noticeClasses } from "@/design-system/components/notice";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { parseDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { MACRO_CODING } from "@/design-system/macros";

import { estimateKcal } from "../services/create-food";
import type { Food } from "../types/food";
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from "../types/food";
import {
  customFoodSchema,
  type CustomFoodInput,
} from "../validation/food-schema";

// The labels and the colours both come from `MACRO_CODING` now. They used to
// be spelled out here without any colour at all, which made this — the one
// screen where somebody *types* protein, carbohydrate and fat — the single
// place in the app where the three were not colour-coded.

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

/** Numbers reach the field the way a Brazilian types them, with a comma. */
function draftFrom(food: Food | null): Draft {
  if (food === null) return EMPTY;

  const text = (value: number) => String(value).replace(".", ",");

  return {
    name: food.name,
    category: food.category,
    kcal: text(food.per100g.kcal),
    proteinG: text(food.per100g.proteinG),
    carbsG: text(food.per100g.carbsG),
    fatG: text(food.per100g.fatG),
  };
}

interface Props {
  /** The food being corrected, or `null` when creating a new one. */
  readonly initial: Food | null;
  readonly save: (input: CustomFoodInput) => Promise<boolean>;
  readonly pending: boolean;
  readonly error: string | null;
}

export function CustomFoodForm({ initial, save, pending, error }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial));
  const [issues, setIssues] = useState<Readonly<Record<string, string>>>({});

  function update(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));

    // Drop the stale message for this field. Validation only runs on submit,
    // so without this the form goes on saying "Nome muito longo." beside a
    // name the person already shortened — the app contradicting what is on
    // screen, at the exact moment it asked for a correction.
    setIssues((current) => {
      const numeric = key !== "name" && key !== "category";
      const field = numeric ? `per100g.${key}` : key;
      // `per100g` holds the cross-field rule (the macros summing past 100 g),
      // which any numeric edit can be the one that resolves.
      const clearsSum = numeric && current["per100g"] !== undefined;

      if (current[field] === undefined && !clearsSum) return current;

      const next = { ...current };
      delete next[field];
      if (clearsSum) delete next["per100g"];
      return next;
    });
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
    if (!(await save(parsed.data))) return;

    // Said out loud, because navigating away is the only other signal and a
    // navigation looks the same whether it followed a save or a cancel.
    toast(
      initial === null
        ? `${parsed.data.name} foi criado.`
        : `${parsed.data.name} foi salvo.`,
    );
    router.push("/alimentos");
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
          <Select
            id={id}
            value={draft.category}
            onChange={(event) => {
              update("category", event.target.value);
            }}
          >
            {FOOD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {FOOD_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-ink">
          Por 100 g{" "}
          <span className="text-ink-subtle">(como está no rótulo)</span>
        </legend>

        <div className="grid grid-cols-3 gap-3">
          {MACRO_CODING.map((macro) => (
            <Field
              key={macro.key}
              label={
                <>
                  <span
                    aria-hidden
                    className={cn("size-1.5 shrink-0 rounded-full", macro.fill)}
                  />
                  {macro.long}
                </>
              }
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
        <p role="alert" className={noticeClasses()}>
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" pending={pending}>
          {initial === null ? "Salvar alimento" : "Salvar alterações"}
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
