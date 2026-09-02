"use client";

import { useState } from "react";

import { formatDay } from "@/core/format/day";
import { cn } from "@/design-system/cn";

interface Props {
  /** `YYYY-MM-DD`, the same shape `dayKey` produces. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly className?: string;
}

/**
 * A DD/MM/AAAA field, typed and drawn by hand rather than
 * `<input type="date">`.
 *
 * Same bug `TimeField` already documents for `type="time"`, one field over:
 * the native picker renders in the OS locale, not the page's — on an
 * English-language Windows install the Diário's date read "09/02/2026" (2 de
 * setembro, mês/dia americano) right next to a page that spells the same day
 * "02/09/2026" everywhere else (achado de auditoria de design, 02/09/2026).
 * `lang="pt-BR"` on `<html>` does not change it — the picker follows
 * Windows' region setting, exactly what `TimeField`'s comment already found
 * for the clock. Same fix: hold the format in a component this app controls
 * instead of a browser widget it does not.
 */
export function DateField({ value, onChange, label, className }: Props) {
  const [draft, setDraft] = useState(() => formatDay(value));
  const [seen, setSeen] = useState(value);

  // A change from elsewhere ("Dia anterior", "Próximo dia", "Hoje") replaces
  // the draft; typing that already matches the committed value is left
  // alone — the same technique `TimeField` uses.
  if (seen !== value) {
    setSeen(value);
    setDraft(formatDay(value));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      value={draft}
      aria-label={label}
      onChange={(event) => {
        const next = mask(event.target.value);
        setDraft(next);

        const parsed = parse(next);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => {
        // Incompleto, ou uma data que o calendário não reconhece (31/02):
        // volta para o último valor válido em vez de deixar o campo com um
        // texto que não corresponde a dia nenhum.
        setDraft(formatDay(value));
      }}
      className={cn("w-32 tabular-nums", className)}
    />
  );
}

/** Digits typed até agora, com as barras inseridas depois do dia e do mês. */
function mask(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** `DD/MM/AAAA` → `YYYY-MM-DD`, ou `null` se ainda não é um dia real. */
function parse(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (match === null) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  // Rejeita uma data que o construtor consertaria em silêncio — 31/02 não
  // vira 3 de março aqui, mesma checagem que `formatLongDay` já faz.
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
