"use client";

import { ChevronRight, FileCheck2 } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/design-system/components/empty-state";
import { PageHeader } from "@/design-system/components/page-header";

import { useAdminData } from "../../hooks/admin-context";
import { describeRegistrations } from "../../types/professional";
import { AdminLoadState } from "./admin-load-state";
import { formatWhen } from "./format";
import { Person } from "./person";
import { ReviewSheet } from "./review-sheet";

/**
 * Pedidos esperando conferência. Cada linha inteira abre a conferência: no
 * computador ela tem as colunas e o rótulo "Conferir"; no celular, nome com
 * registro e data embaixo, e a seta (protótipo, os dois modos).
 */
export function AdminRequests() {
  const admin = useAdminData();
  const [openId, setOpenId] = useState<string | null>(null);

  if (admin.state.status !== "ready") return <AdminLoadState state={admin.state} />;
  const pending = admin.state.professionals.filter((record) => record.status === "pending");
  const open = pending.find((record) => record.userId === openId) ?? null;

  return (
    <>
      <PageHeader
        icon={FileCheck2}
        title="Pedidos de acesso"
        subtitle={
          pending.length === 0
            ? "Tudo conferido."
            : `${String(pending.length)} ${pending.length === 1 ? "pedido esperando" : "pedidos esperando"} sua conferência.`
        }
      />

      <div className="mt-8">
        {pending.length === 0 ? (
          <EmptyState
            icon={FileCheck2}
            title="Nenhum pedido esperando."
            caption="Quando alguém pedir acesso ao Life Pro pelo Perfil, o pedido aparece aqui."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div
              aria-hidden
              className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem] gap-4 border-b border-line px-5 py-3 text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase md:grid"
            >
              <span>Pessoa</span>
              <span>Profissão</span>
              <span>Registro</span>
              <span>Pedido em</span>
              <span />
            </div>
            <ul>
              {pending.map((record) => (
                <li key={record.userId} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    aria-label={`Conferir o pedido de ${record.displayName}`}
                    onClick={() => {
                      setOpenId(record.userId);
                    }}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left transition-colors duration-(--duration-micro) ease-out hover:bg-muted md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem] md:px-5"
                  >
                    <span className="md:hidden">
                      <Person
                        name={record.displayName}
                        detail={`${describeRegistrations(record.registrations).join(" · ")} · ${formatWhen(record.requestedAt)}`}
                      />
                    </span>
                    <span className="hidden md:block">
                      <Person name={record.displayName} detail={record.email} />
                    </span>
                    <span className="hidden text-sm text-ink-muted md:block">Treinador</span>
                    <span className="hidden text-sm text-ink tabular-nums md:block">
                      {describeRegistrations(record.registrations).map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </span>
                    <span className="hidden text-sm text-ink-muted tabular-nums md:block">
                      {formatWhen(record.requestedAt)}
                    </span>
                    <ChevronRight aria-hidden className="size-5 text-ink-subtle md:hidden" />
                    <span className="hidden h-9 items-center justify-center rounded-md border border-line-strong px-3 text-sm font-semibold text-ink md:inline-flex">
                      Conferir
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-subtle">
              Ninguém usa o Life Pro antes de você aprovar. Quem pediu vê &quot;Em análise&quot; no Perfil.
            </p>
          </div>
        )}
      </div>

      {open !== null && (
        <ReviewSheet
          key={open.userId}
          record={open}
          onClose={() => {
            setOpenId(null);
          }}
          onApprove={() => admin.approve(open.userId)}
          onReject={(reason) => admin.reject(open.userId, reason)}
        />
      )}
    </>
  );
}
