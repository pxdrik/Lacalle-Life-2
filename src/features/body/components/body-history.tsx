"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Card } from "@/design-system/components/card";
import { ConfirmButton } from "@/design-system/components/confirm-button";

import { formatDecimal } from "@/core/format/decimal";
import { formatDay } from "@/core/format/day";

import {
  MEASUREMENT_SITE_LABELS,
  MEASUREMENT_SITES,
} from "../taxonomy/measurement-sites";
import type { BodyEntry } from "../types/body-entry";

interface Props {
  readonly entries: readonly BodyEntry[];
  readonly onEdit: (day: string) => void;
  readonly onRemove: (day: string) => void;
}

/**
 * Every day recorded, newest first.
 *
 * The chart answers "where am I going"; this answers "what did I actually
 * write down on 3 March", which is the question you ask when a number looks
 * wrong and you want to fix it.
 */
export function BodyHistory({ entries, onEdit, onRemove }: Props) {
  const newestFirst = [...entries].reverse();

  return (
    <Card padded={false} className="overflow-hidden">
      <ul className="divide-y divide-line">
        {newestFirst.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm tabular-nums text-ink">
                {formatDay(entry.day)}
                {entry.weightKg !== null && (
                  <span className="ml-3 text-ink-muted">
                    {formatDecimal(entry.weightKg)} kg
                  </span>
                )}
                {entry.bodyFatPercent !== null && (
                  <span className="ml-3 text-ink-muted">
                    {formatDecimal(entry.bodyFatPercent)}%
                  </span>
                )}
              </p>

              <Sites entry={entry} />

              {entry.notes !== "" && (
                <p className="mt-1 truncate text-xs text-ink-subtle">
                  {entry.notes}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onEdit(entry.day);
              }}
              aria-label={`Editar ${formatDay(entry.day)}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
            >
              <Pencil aria-hidden className="size-4" />
            </button>

            <ConfirmButton
              label={`Excluir a medição de ${formatDay(entry.day)}`}
              confirmLabel="Excluir?"
              onConfirm={() => {
                onRemove(entry.day);
              }}
            >
              <Trash2 aria-hidden className="size-4" />
            </ConfirmButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Sites({ entry }: { readonly entry: BodyEntry }) {
  const taken = MEASUREMENT_SITES.filter(
    (site) => entry.measurements[site] !== null,
  );

  if (taken.length === 0) return null;

  return (
    <p className="mt-0.5 text-xs tabular-nums text-ink-subtle">
      {taken
        .map((site) => {
          // `toLocaleString`, not `String`: the rest of the app writes 84,2
          // and a stray 84.2 here reads as a different app.
          //
          // And not `formatDecimal`, which is what every *display* surface
          // uses — this string is fed back into a text field for editing, and
          // `formatDecimal` answers unreadable input with an em dash. A dash
          // is the right thing to show and the wrong thing to hand someone to
          // edit. The guard in `number-format.test.ts` exempts this line.
          const value = entry.measurements[site]?.toLocaleString("pt-BR") ?? "";
          return `${MEASUREMENT_SITE_LABELS[site]} ${value}`;
        })
        .join(" · ")}
    </p>
  );
}
