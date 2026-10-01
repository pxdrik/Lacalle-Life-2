import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";

import type { QuickMacro } from "../types/diet";

/**
 * O que falta num número (registro rápido, roadmap 7.7).
 *
 * - `"unknown"`: o próprio valor não foi informado (a linha de um avulso). Mostra
 *   "—", nunca 0.
 * - `"partial"`: um total que soma o que se sabe e deixa de fora algum avulso.
 *   Mostra o valor com um "*" verde, para chamar atenção (Pedro, 30/09/2026);
 *   quem mostra o total põe a nota que explica (`QuickGapNote`).
 */
export type MacroGap = "unknown" | "partial";
export type MacroGaps = Readonly<Partial<Record<keyof Macros, MacroGap>>>;

export function IncompleteMark() {
  return (
    <>
      <span aria-hidden className="font-semibold text-accent-text">*</span>
      <span className="sr-only">, incompleto</span>
    </>
  );
}

export function MacroNumber({ value, gap }: { readonly value: number; readonly gap?: MacroGap | undefined }) {
  if (gap === "unknown") {
    return (
      <>
        <span aria-hidden>—</span>
        <span className="sr-only">não informado</span>
      </>
    );
  }
  return (
    <>
      {formatDecimal(value)}
      {gap === "partial" && <IncompleteMark />}
    </>
  );
}

const ORDER = ["kcal", "proteinG", "carbsG", "fatG"] as const;

/** As lacunas de um total, a partir de `quickGaps`. */
export function partialGaps(gaps: Readonly<Record<QuickMacro, number>>): MacroGaps {
  const result: Partial<Record<keyof Macros, MacroGap>> = {};
  for (const key of ORDER) {
    if (gaps[key] > 0) result[key] = "partial";
  }
  return result;
}

const LONG: Readonly<Record<QuickMacro, string>> = {
  kcal: "as calorias",
  proteinG: "a proteína",
  carbsG: "o carboidrato",
  fatG: "a gordura",
};

/**
 * "* Sem a gordura de 1 item avulso.": a nota que acompanha um total com "*".
 * Nada quando o total está completo.
 */
export function QuickGapNote({
  gaps,
  count,
  className,
}: {
  readonly gaps: Readonly<Record<QuickMacro, number>>;
  readonly count: number;
  readonly className?: string;
}) {
  const missing = ORDER.filter((key) => gaps[key] > 0);
  if (missing.length === 0) return null;

  const names = missing.map((key) => LONG[key]);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]!}`;

  return (
    <p className={className ?? "text-xs text-ink-subtle"}>
      <span aria-hidden className="font-semibold text-accent-text">*</span> Sem {list} de{" "}
      {count === 1 ? "1 item avulso" : `${String(count)} itens avulsos`}.
    </p>
  );
}
