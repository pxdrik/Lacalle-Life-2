"use client";

import { ChevronRight, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Dialog } from "@/design-system/components/dialog";
import { EmptyState } from "@/design-system/components/empty-state";
import { PageHeader } from "@/design-system/components/page-header";

import { useCareRepository } from "../../data/care-repository-context";
import { useAdminData } from "../../hooks/admin-context";
import { describeSharing, type PatientLink } from "../../types/care";
import { describeRegistrations, type AuditEntry, type ProfessionalRecord } from "../../types/professional";
import { AdminLoadState } from "./admin-load-state";
import { AuditList } from "./admin-history";
import { formatWhen } from "./format";
import { Person } from "./person";

/**
 * Quem pode usar o Life Pro, e quem está suspenso. Tocar abre os detalhes:
 * registro, conta, quando foi aprovado, o histórico daquela pessoa e
 * suspender ou reativar, e os pacientes: só o vínculo (quem, o que liberou,
 * a situação), nunca o conteúdo.
 */
export function AdminApproved() {
  const admin = useAdminData();
  const [openId, setOpenId] = useState<string | null>(null);

  if (admin.state.status !== "ready") return <AdminLoadState state={admin.state} />;
  const { audit } = admin.state;
  const people = admin.state.professionals.filter(
    (record) => record.status === "approved" || record.status === "suspended",
  );
  const open = people.find((record) => record.userId === openId) ?? null;

  return (
    <>
      <PageHeader icon={UserCheck} title="Profissionais aprovados" subtitle="Quem pode usar o Life Pro hoje." />

      <div className="mt-8">
        {people.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Ninguém aprovado ainda."
            caption="Quem você aprovar em Pedidos aparece aqui."
          />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-line bg-surface">
            {people.map((record) => (
              <li key={record.userId} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  aria-label={`Ver ${record.displayName}`}
                  onClick={() => {
                    setOpenId(record.userId);
                  }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors duration-(--duration-micro) ease-out hover:bg-muted md:px-5"
                >
                  <Person name={record.displayName} detail={`${describeRegistrations(record.registrations).join(" · ")} · ${record.email}`} />
                  <StatusBadge record={record} />
                  <ChevronRight aria-hidden className="size-5 text-ink-subtle" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-subtle">
          Suspender tira o acesso ao Life Pro na hora. Nada é apagado: reativar devolve tudo como estava.
        </p>
      </div>

      {open !== null && (
        <ProfessionalSheet
          key={open.userId}
          record={open}
          audit={audit.filter((entry) => entry.targetUserId === open.userId)}
          onClose={() => {
            setOpenId(null);
          }}
          onSuspend={(suspended) => admin.setSuspended(open.userId, suspended)}
        />
      )}
    </>
  );
}

const SHORT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/** Os vínculos de um profissional (0034): quem, o que liberou, a situação. */
function useLinksOf(professionalId: string): readonly PatientLink[] | null {
  const care = useCareRepository();
  const [links, setLinks] = useState<readonly PatientLink[] | null>(null);
  useEffect(() => {
    let active = true;
    care
      .listLinksOf(professionalId)
      .then((list) => {
        if (active) setLinks(list);
      })
      .catch(() => {
        if (active) setLinks([]);
      });
    return () => {
      active = false;
    };
  }, [care, professionalId]);
  return links;
}

function PatientLinks({ links }: { readonly links: readonly PatientLink[] | null }) {
  if (links === null) return <p className="text-sm text-ink-subtle">Carregando…</p>;
  if (links.length === 0) return <p className="text-sm text-ink-subtle">Nenhum paciente ainda.</p>;
  return (
    <ul className="divide-y divide-line">
      {links.map((link) => (
        <li key={link.id} className="flex items-start justify-between gap-3 py-2.5">
          <Person
            name={link.label}
            detail={link.status === "active" ? describeSharing(link.sharing) : "Sem acesso"}
          />
          <span className="flex shrink-0 flex-col items-end gap-1">
            {link.status === "active" ? <Badge state="concluido">Ativo</Badge> : <Badge state="neutro">Encerrado</Badge>}
            <span className="text-xs text-ink-subtle tabular-nums">
              {link.status === "active" ? "desde" : "encerrado em"}{" "}
              {SHORT.format(new Date(link.status === "active" ? link.createdAt : (link.endedAt ?? link.createdAt)))}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ record }: { readonly record: ProfessionalRecord }) {
  return record.status === "approved" ? (
    <Badge state="concluido">Ativo</Badge>
  ) : (
    <Badge state="negativo">Suspenso</Badge>
  );
}

function ProfessionalSheet({
  record,
  audit,
  onClose,
  onSuspend,
}: {
  readonly record: ProfessionalRecord;
  readonly audit: readonly AuditEntry[];
  readonly onClose: () => void;
  readonly onSuspend: (suspended: boolean) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const approval = audit.find((entry) => entry.action === "approve");
  const links = useLinksOf(record.userId);

  async function change(suspended: boolean) {
    setPending(true);
    setFailed(false);
    try {
      await onSuspend(suspended);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open title={record.displayName} onClose={onClose} placement="sheet-bottom">
      <div className="space-y-4">
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="text-ink-subtle">Situação</dt>
          <dd>
            <StatusBadge record={record} />
          </dd>
          <dt className="text-ink-subtle">Profissão</dt>
          <dd className="font-medium text-ink">Treinador</dd>
          <dt className="text-ink-subtle">Registro</dt>
          <dd className="font-medium text-ink tabular-nums">{describeRegistrations(record.registrations).join(" · ")}</dd>
          <dt className="text-ink-subtle">Conta</dt>
          <dd className="font-medium break-all text-ink">{record.email}</dd>
          {approval !== undefined && (
            <>
              <dt className="text-ink-subtle">Aprovado</dt>
              <dd className="font-medium text-ink tabular-nums">{formatWhen(approval.createdAt)}, por você</dd>
            </>
          )}
        </dl>

        <section className="space-y-2 rounded-lg border border-line p-4">
          <h3 className="text-sm font-semibold text-ink">Pacientes</h3>
          <PatientLinks links={links} />
          <p className="text-xs text-ink-subtle">
            Você vê com quem ela tem vínculo e o que cada pessoa liberou. Diário, evolução e planos não aparecem aqui:
            são dos pacientes.
          </p>
        </section>

        <section className="space-y-2 rounded-lg border border-line p-4">
          <h3 className="text-sm font-semibold text-ink">Histórico</h3>
          <AuditList entries={audit} />
        </section>

        {failed && (
          <p role="alert" className="text-sm text-danger-text">
            Não foi possível salvar. Confira a conexão e tente de novo.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          {record.status === "approved" ? (
            <ConfirmButton
              label={`Suspender ${record.displayName}`}
              confirmLabel="Suspender mesmo?"
              onConfirm={() => void change(true)}
              className="h-(--control-h) w-full px-4 text-sm"
            >
              Suspender
            </ConfirmButton>
          ) : (
            <Button pending={pending} onClick={() => void change(false)}>
              Reativar
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
