"use client";

import { useState } from "react";

import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";

import type { QuickInput } from "../services/quick-item";

/** Um limite de sanidade, não uma regra de nutrição: pega um zero a mais digitado. */
const MAX_KCAL = 10_000;
const MAX_MACRO_G = 1_000;

interface Props {
  readonly open: boolean;
  readonly mealName: string;
  /** Preenchido ao editar um avulso; `null` para um registro novo. */
  readonly initial: QuickInput | null;
  readonly onClose: () => void;
  readonly onSave: (input: QuickInput) => void;
}

/**
 * A folha do registro rápido (roadmap 7.7, protótipo aprovado em 29/09/2026):
 * para quando se sabe as calorias e não os alimentos. Tudo opcional desde
 * 30/09/2026 (Pedro), calorias inclusive, com pelo menos um valor; o que
 * ficar em branco continua em branco.
 *
 * Montada a cada abertura (`key` em quem usa) para começar do `initial`
 * certo, em vez de sincronizar estado com efeito.
 */
export function QuickLogDialog({ open, mealName, initial, onClose, onSave }: Props) {
  const text = (value: number | null | undefined) =>
    value === null || value === undefined ? "" : formatDecimal(value);

  const [name, setName] = useState(initial?.name ?? "");
  const [kcal, setKcal] = useState(text(initial?.kcal));
  const [proteinG, setProteinG] = useState(text(initial?.proteinG));
  const [carbsG, setCarbsG] = useState(text(initial?.carbsG));
  const [fatG, setFatG] = useState(text(initial?.fatG));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};

    let kcalValue: number | null = null;
    if (kcal.trim() !== "") {
      kcalValue = parseDecimal(kcal);
      if (kcalValue === null || kcalValue < 0 || kcalValue > MAX_KCAL) {
        next["kcal"] = `Entre 0 e ${formatDecimal(MAX_KCAL)} kcal, ou em branco.`;
        kcalValue = null;
      }
    }

    const macro = (key: string, raw: string): number | null => {
      if (raw.trim() === "") return null;
      const value = parseDecimal(raw);
      if (value === null || value < 0 || value > MAX_MACRO_G) {
        next[key] = `Entre 0 e ${formatDecimal(MAX_MACRO_G)} g, ou em branco.`;
        return null;
      }
      return value;
    };
    const protein = macro("proteinG", proteinG);
    const carbs = macro("carbsG", carbsG);
    const fat = macro("fatG", fatG);

    // Tudo em branco não registra nada: pelo menos um valor.
    if (Object.keys(next).length === 0 && [kcal, proteinG, carbsG, fatG].every((raw) => raw.trim() === "")) {
      next["kcal"] = "Preencha pelo menos um valor.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSave({
      name,
      kcal: kcalValue === null ? null : Math.round(kcalValue),
      proteinG: protein,
      carbsG: carbs,
      fatG: fat,
    });
  }

  const macroField = (key: string, label: string, value: string, set: (value: string) => void) => (
    <Field label={label} id={`quick-${key}`} error={errors[key]}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          inputMode="decimal"
          placeholder="—"
          value={value}
          onChange={(event) => {
            set(event.target.value);
          }}
        />
      )}
    </Field>
  );

  return (
    <Dialog
      open={open}
      title={initial === null ? `Registro rápido no ${mealName}` : "Editar registro rápido"}
      onClose={onClose}
      placement="sheet-bottom"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-ink-muted">
          Para quando você sabe as calorias, mas não os alimentos. Não entra no catálogo.
        </p>

        <Field label="Descrição (opcional)" id="quick-name">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              placeholder="Avulso"
              maxLength={80}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          )}
        </Field>

        <Field label="Calorias" id="quick-kcal" error={errors["kcal"]}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              inputMode="numeric"
              placeholder="—"
              value={kcal}
              onChange={(event) => {
                setKcal(event.target.value);
              }}
            />
          )}
        </Field>

        <div className="grid grid-cols-3 gap-3">
          {macroField("proteinG", "Prot. (g)", proteinG, setProteinG)}
          {macroField("carbsG", "Carb. (g)", carbsG, setCarbsG)}
          {macroField("fatG", "Gord. (g)", fatG, setFatG)}
        </div>

        <p className="text-xs text-ink-subtle">
          O que ficar em branco fica em branco no total, não vira zero.
        </p>

        <Button type="submit" size="lg" className="w-full">
          {initial === null ? "Registrar" : "Salvar"}
        </Button>
      </form>
    </Dialog>
  );
}
