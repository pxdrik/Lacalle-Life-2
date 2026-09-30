import { formatDecimal } from "@/core/format/decimal";
import type { MacroKey } from "@/design-system/macros";

import type { QuickMacro } from "../types/diet";

/**
 * O que falta num número de macro (registro rápido, roadmap 7.7).
 *
 * - `"unknown"`: o próprio valor não foi informado (a linha de um avulso). Mostra
 *   "—", nunca 0.
 * - `"partial"`: um total que soma o que se sabe e deixa de fora algum avulso.
 *   Mostra o valor com "*"; quem mostra o total põe a nota que explica
 *   (`QuickGapNote`).
 */
export type MacroGap = "unknown" | "partial";
export type MacroGaps = Readonly<Partial<Record<MacroKey, MacroGap>>>;

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
      {gap === "partial" && (
        <>
          <span aria-hidden>*</span>
          <span className="sr-only">, incompleto</span>
        </>
      )}
    </>
  );
}

/** As lacunas de um total, a partir de `quickGaps`. */
export function partialGaps(gaps: Readonly<Record<QuickMacro, number>>): MacroGaps {
  const result: Partial<Record<MacroKey, MacroGap>> = {};
  for (const key of ["proteinG", "carbsG", "fatG"] as const) {
    if (gaps[key] > 0) result[key] = "partial";
  }
  return result;
}

const LONG: Readonly<Record<QuickMacro, string>> = {
  proteinG: "a proteína",
  carbsG: "o carboidrato",
  fatG: "a gordura",
};

/**
 * "* sem a gordura de 1 item avulso": a nota que acompanha um total com "*".
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
  const missing = (["proteinG", "carbsG", "fatG"] as const).filter((key) => gaps[key] > 0);
  if (missing.length === 0) return null;

  const names = missing.map((key) => LONG[key]);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]!}`;

  return (
    <p className={className ?? "text-xs text-ink-subtle"}>
      * Sem {list} de {count === 1 ? "1 item avulso" : `${String(count)} itens avulsos`}.
    </p>
  );
}
