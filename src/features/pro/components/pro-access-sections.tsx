"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/design-system/components/badge";
import { Button, buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Section } from "@/design-system/components/section";

import { useProRepository } from "../data/pro-repository-context";
import { useMyAccess } from "../hooks/use-my-access";
import { describeRegistrations, REJECTION_REASON_MESSAGES, type OwnProfessional } from "../types/professional";
import { CareSection } from "./care/care-section";
import { RequestAccessDialog } from "./request-access-dialog";

/**
 * No Perfil, logo depois de "Conta e sincronização" (protótipos aprovados em
 * 30/09/2026): "Acompanhamento", para quem tem ou teve uma profissional; a
 * "Área profissional", para quem tem conta; e a "Administração", só para o
 * administrador. Sem conta não aparece nada:
 * pedido e administração moram na conta, não no aparelho.
 *
 * Esconder a seção não protege nada; quem decide é o banco (0033). Aqui só se
 * mostra o que a conta pode fazer.
 */
export function ProAccessSections() {
  const { state, request } = useMyAccess();
  const [asking, setAsking] = useState(false);
  const isAdmin = state.status === "ready" && state.access?.isAdmin === true;
  const pendingRequests = usePendingRequests(isAdmin);

  if (state.status !== "ready" || state.access === null) return null;
  const { professional } = state.access;

  return (
    <>
      <CareSection />

      <Section title="Área profissional">
        <ProfessionalCard
          professional={professional}
          onAsk={() => {
            setAsking(true);
          }}
        />
      </Section>

      {isAdmin && (
        <Section title="Administração">
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="flex-1 font-medium text-ink">Pedidos de acesso ao Life Pro</p>
              {pendingRequests > 0 && (
                <Badge state="atencao">{String(pendingRequests)}</Badge>
              )}
            </div>
            <p className="text-sm text-ink-muted">Conferir registros, aprovar, recusar e suspender profissionais.</p>
            <Link href="/admin" className={buttonClasses("secondary", "sm")}>
              Abrir administração
            </Link>
          </Card>
        </Section>
      )}

      {asking && (
        <RequestAccessDialog
          open
          initial={
            professional === null
              ? null
              : {
                  displayName: professional.displayName,
                  registrations: professional.registrations,
                }
          }
          onClose={() => {
            setAsking(false);
          }}
          onSubmit={request}
        />
      )}
    </>
  );
}

/** Quantos pedidos esperam conferência, só para quem administra. */
function usePendingRequests(isAdmin: boolean): number {
  const repository = useProRepository();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    repository
      .listProfessionals()
      .then((list) => {
        if (alive) setCount(list.filter((record) => record.status === "pending").length);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isAdmin, repository]);
  return count;
}

function ProfessionalCard({
  professional,
  onAsk,
}: {
  readonly professional: OwnProfessional | null;
  readonly onAsk: () => void;
}) {
  if (professional === null) {
    return (
      <Card className="space-y-3">
        <p className="font-medium text-ink">Você é treinador?</p>
        <p className="text-sm text-ink-muted">
          Com o Life Pro você monta plano alimentar e treino e acompanha pacientes, usando esta mesma conta.
        </p>
        <Button variant="secondary" size="sm" onClick={onAsk}>
          Pedir acesso ao Life Pro
        </Button>
      </Card>
    );
  }

  const registry = describeRegistrations(professional.registrations).join(" e o ");

  switch (professional.status) {
    case "pending":
      return (
        <Card className="space-y-2">
          <Badge state="atencao">Em análise</Badge>
          <p className="font-medium text-ink">Recebemos seu pedido.</p>
          <p className="text-sm text-ink-muted">
            Vamos conferir o {registry}. Quando for aprovado, o Life Pro aparece aqui.
          </p>
        </Card>
      );
    case "rejected":
      return (
        <Card className="space-y-3">
          <Badge state="negativo">Não aprovado</Badge>
          <p className="text-sm text-ink-muted">
            {professional.rejectionReason === null
              ? "Não conseguimos confirmar o registro. Confira os dados e envie de novo."
              : REJECTION_REASON_MESSAGES[professional.rejectionReason]}
          </p>
          <Button variant="secondary" size="sm" onClick={onAsk}>
            Corrigir e enviar de novo
          </Button>
        </Card>
      );
    case "approved":
      return (
        <Card className="space-y-3">
          <Badge state="concluido">Aprovado</Badge>
          <p className="font-medium text-ink">Life Pro liberado.</p>
          <p className="text-sm text-ink-muted">
            Funciona melhor no computador ou no tablet. Sua dieta e seu diário continuam aqui, como sempre.
          </p>
          <Link href="/pro" className={buttonClasses("primary", "sm")}>
            Abrir Life Pro
          </Link>
        </Card>
      );
    case "suspended":
      return (
        <Card className="space-y-2">
          <Badge state="neutro">Suspenso</Badge>
          <p className="text-sm text-ink-muted">
            Seu acesso ao Life Pro está suspenso. Para entender o motivo, escreva para lacallepm@gmail.com.
          </p>
        </Card>
      );
  }
}
