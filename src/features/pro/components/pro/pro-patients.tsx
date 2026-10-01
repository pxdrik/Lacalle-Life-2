"use client";

import { Plus, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { EmptyState } from "@/design-system/components/empty-state";
import { noticeClasses } from "@/design-system/components/notice";
import { PageHeader } from "@/design-system/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";

import { usePatients } from "../../hooks/use-patients";
import { describeSharing, type PatientLink, type PendingInvite } from "../../types/care";
import { Person } from "../admin/person";
import { InviteDialog } from "./invite-dialog";

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * Pacientes (protótipo v3): quem tem vínculo ativo, os convites esperando
 * resposta e os vínculos encerrados. "Adicionar paciente" gera o link do
 * convite. O nome abre a página do paciente, com o plano (Etapa 5); diário e
 * evolução chegam com a Etapa 6.
 */
export function ProPatients() {
  const patients = usePatients();
  const [inviting, setInviting] = useState(false);

  const add = (
    <Button
      onClick={() => {
        setInviting(true);
      }}
    >
      <Plus aria-hidden className="size-4" />
      Adicionar paciente
    </Button>
  );

  return (
    <>
      <PageHeader icon={Users} title="Pacientes" subtitle={subtitle(patients.state)}>
        {add}
      </PageHeader>

      <div className="mt-8 space-y-8">
        {patients.state.status === "loading" && <Skeleton className="h-48" />}
        {patients.state.status === "error" && (
          <div role="alert" className={noticeClasses("danger", "block")}>
            <p className="text-ink">Não foi possível carregar os pacientes.</p>
            <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e recarregue a página.</p>
          </div>
        )}
        {patients.state.status === "ready" &&
          (patients.state.links.length === 0 && patients.state.invites.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum paciente ainda."
              caption="Gere um link de convite e envie para o paciente. Ele aparece aqui quando aceitar."
              action={{
                label: "Adicionar paciente",
                onClick: () => {
                  setInviting(true);
                },
                icon: Plus,
              }}
            />
          ) : (
            <Lists
              links={patients.state.links}
              invites={patients.state.invites}
              onCancel={(id) => void patients.cancelInvite(id)}
              onEnd={(id) => void patients.endLink(id)}
            />
          ))}
      </div>

      {inviting && (
        <InviteDialog
          onClose={() => {
            setInviting(false);
          }}
          onCreate={patients.createInvite}
        />
      )}
    </>
  );
}

function subtitle(state: ReturnType<typeof usePatients>["state"]): string {
  if (state.status !== "ready") return "Quem você acompanha.";
  const active = state.links.filter((link) => link.status === "active").length;
  const parts = [`${String(active)} ${active === 1 ? "ativo" : "ativos"}`];
  if (state.invites.length > 0) {
    parts.push(`${String(state.invites.length)} ${state.invites.length === 1 ? "convite esperando" : "convites esperando"}`);
  }
  return parts.join(", ");
}

function Lists({
  links,
  invites,
  onCancel,
  onEnd,
}: {
  readonly links: readonly PatientLink[];
  readonly invites: readonly PendingInvite[];
  readonly onCancel: (id: string) => void;
  readonly onEnd: (id: string) => void;
}) {
  const active = links.filter((link) => link.status === "active");
  const ended = links.filter((link) => link.status === "ended");

  return (
    <>
      {active.length > 0 && (
        <Group title="Com vínculo ativo">
          {active.map((link) => (
            <Row
              key={link.id}
              person={
                <PatientLinkTo id={link.id}>
                  <Person name={link.label} detail={`Vê: ${describeSharing(link.sharing)} · desde ${DATE.format(new Date(link.createdAt))}`} />
                </PatientLinkTo>
              }
              badge={<Badge state="concluido">Ativo</Badge>}
              action={
                <ConfirmButton
                  label={`Encerrar vínculo com ${link.label}`}
                  confirmLabel="Encerrar mesmo?"
                  onConfirm={() => {
                    onEnd(link.id);
                  }}
                  className="h-(--control-h-sm) px-3 text-[0.8125rem]"
                >
                  Encerrar
                </ConfirmButton>
              }
            />
          ))}
        </Group>
      )}

      {invites.length > 0 && (
        <Group title="Convites esperando">
          {invites.map((invite) => (
            <Row
              key={invite.id}
              person={<Person name={invite.label} detail={`Enviado em ${DATE.format(new Date(invite.createdAt))} · vence em ${DATE.format(new Date(invite.expiresAt))}`} />}
              badge={<Badge state="atencao">Convite</Badge>}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onCancel(invite.id);
                  }}
                >
                  Cancelar
                </Button>
              }
            />
          ))}
        </Group>
      )}

      {ended.length > 0 && (
        <Group title="Encerrados">
          {ended.map((link) => (
            <Row
              key={link.id}
              person={
                <PatientLinkTo id={link.id}>
                  <Person name={link.label} detail={`Encerrado em ${DATE.format(new Date(link.endedAt ?? link.createdAt))}`} />
                </PatientLinkTo>
              }
              badge={<Badge state="neutro">Encerrado</Badge>}
            />
          ))}
        </Group>
      )}

      <p className="text-xs text-ink-subtle">
        Com o vínculo encerrado, você mantém os planos que publicou. Diário e evolução do paciente deixam de aparecer.
      </p>
    </>
  );
}

/** Encerrado também abre: os planos publicados continuam lá, só para leitura. */
function PatientLinkTo({ id, children }: { readonly id: string; readonly children: React.ReactNode }) {
  return (
    <Link
      href={`/pro/pacientes/${id}` as Route}
      className="-m-1 block rounded-md p-1 transition-colors duration-150 ease-out hover:bg-muted"
    >
      {children}
    </Link>
  );
}

function Group({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <ul className="overflow-hidden rounded-lg border border-line bg-surface">{children}</ul>
    </section>
  );
}

/**
 * Pessoa, situação e ação. No celular a situação e a ação descem para baixo do
 * nome (o nome nunca divide a linha com dois controles), e a ação desce mais
 * uma linha se não couber ao lado da situação: abaixo de 400px Confortável
 * ela passava da borda da linha (medido). A partir de `sm`, tudo numa linha.
 */
function Row({
  person,
  badge,
  action,
}: {
  readonly person: React.ReactNode;
  readonly badge: React.ReactNode;
  readonly action?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 md:px-5">
      <div className="min-w-0 flex-1">{person}</div>
      <div className="flex flex-wrap items-center gap-3">
        {badge}
        {action}
      </div>
    </li>
  );
}
