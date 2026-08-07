"use client";

import { Pencil, Trash2 } from "lucide-react";

import { ConfirmButton } from "@/design-system/components/confirm-button";

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
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <ul className="divide-y divide-line">
        {newestFirst.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm tabular-nums text-ink">
                {formatDay(entry.day)}
                {entry.weightKg !== null && (
                  <span className="ml-3 text-ink-muted">
                    {entry.weightKg.toLocaleString("pt-BR")} kg
                  </span>
                )}
                {entry.bodyFatPercent !== null && (
                  <span className="ml-3 text-ink-muted">
                    {entry.bodyFatPercent.toLocaleString("pt-BR")}%
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
              label={`Apagar ${formatDay(entry.day)}`}
              onConfirm={() => {
                onRemove(entry.day);
              }}
            >
              <Trash2 aria-hidden className="size-4" />
            </ConfirmButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sites({ entry }: { readonly entry: BodyEntry }) {
  const taken = MEASUREMENT_SITES.filter(
    (site) => entry.measurements[site] !== null,
  );

  if (taken.length === 0) return null;

  return (
    <p className="mt-0.5 font-mono text-xs tabular-nums text-ink-subtle">
      {taken
        .map((site) => {
          // `toLocaleString`, not `String`: the rest of the app writes 84,2
          // and a stray 84.2 here reads as a different app.
          const value = entry.measurements[site]?.toLocaleString("pt-BR") ?? "";
          return `${MEASUREMENT_SITE_LABELS[site]} ${value}`;
        })
        .join(" · ")}
    </p>
  );
}
