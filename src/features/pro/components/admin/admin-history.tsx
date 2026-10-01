"use client";

import { CircleCheck, CircleX, History, PauseCircle, PlayCircle } from "lucide-react";

import { EmptyState } from "@/design-system/components/empty-state";
import { PageHeader } from "@/design-system/components/page-header";

import { useAdminData } from "../../hooks/admin-context";
import { REJECTION_REASON_LABELS, type AuditAction, type AuditEntry } from "../../types/professional";
import { AdminLoadState } from "./admin-load-state";
import { formatWhen } from "./format";

const ACTIONS: Readonly<Record<AuditAction, { readonly verb: string; readonly icon: typeof CircleCheck }>> = {
  approve: { verb: "aprovou", icon: CircleCheck },
  reject: { verb: "recusou", icon: CircleX },
  suspend: { verb: "suspendeu", icon: PauseCircle },
  reactivate: { verb: "reativou", icon: PlayCircle },
};

/** Cada aprovação, recusa e suspensão, com data. Guardado no banco, não aqui. */
export function AdminHistory() {
  const admin = useAdminData();
  if (admin.state.status !== "ready") return <AdminLoadState state={admin.state} />;

  return (
    <>
      <PageHeader icon={History} title="Histórico" subtitle="Cada aprovação, recusa e suspensão, com data." />
      <div className="mt-8">
        {admin.state.audit.length === 0 ? (
          <EmptyState icon={History} title="Nada registrado ainda." caption="As decisões sobre os pedidos aparecem aqui." />
        ) : (
          <div className="rounded-lg border border-line bg-surface px-5 py-2">
            <AuditList entries={admin.state.audit} />
          </div>
        )}
      </div>
    </>
  );
}

export function AuditList({ entries }: { readonly entries: readonly AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-ink-subtle">Nada registrado.</p>;
  return (
    <ul className="divide-y divide-line">
      {entries.map((entry) => {
        const { verb, icon: Icon } = ACTIONS[entry.action];
        return (
          <li key={entry.id} className="flex items-start gap-3 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-ink-muted">
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="break-words text-ink">
                Você {verb} {entry.displayName}
              </p>
              <p className="text-ink-subtle">
                {entry.reason !== null ? `Motivo: ${REJECTION_REASON_LABELS[entry.reason].toLowerCase()}` : entry.council}
              </p>
              <p className="text-xs text-ink-subtle tabular-nums">{formatWhen(entry.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
