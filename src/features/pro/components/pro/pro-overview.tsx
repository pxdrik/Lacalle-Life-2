"use client";

import { LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Metric } from "@/design-system/components/metric";
import { PageHeader } from "@/design-system/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";

import { usePatients } from "../../hooks/use-patients";
import { describeSharing } from "../../types/care";
import { Person } from "../admin/person";

const TODAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

/**
 * Visão geral (protótipo v3). Só números reais: pacientes com vínculo ativo
 * e convites esperando. "Registraram nos últimos dias", planos publicados e a
 * atividade recente entram quando houver de onde lê-los (Etapas 5 e 6); até
 * lá não aparecem, em vez de aparecer zerados.
 */
export function ProOverview() {
  const { state } = usePatients();
  const today = TODAY.format(new Date());

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Visão geral"
        subtitle={today.charAt(0).toUpperCase() + today.slice(1)}
      >
        <Link href="/pro/pacientes" className={buttonClasses("primary")}>
          <Plus aria-hidden className="size-4" />
          Adicionar paciente
        </Link>
      </PageHeader>

      <div className="mt-8 space-y-6">
        {state.status === "loading" && <Skeleton className="h-32" />}
        {state.status === "ready" &&
          (state.links.length === 0 && state.invites.length === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              title="Seu consultório começa pelos pacientes."
              caption="Convide o primeiro paciente em Pacientes. Quando ele aceitar, o acompanhamento aparece aqui."
              action={{ label: "Ir para Pacientes", href: "/pro/pacientes" }}
            />
          ) : (
            <>
              <Card className="grid grid-cols-2 gap-4">
                <Metric
                  value={String(state.links.filter((link) => link.status === "active").length)}
                  label="Pacientes ativos"
                />
                <Metric value={String(state.invites.length)} label="Convites esperando" />
              </Card>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-ink">Pacientes</h2>
                <ul className="overflow-hidden rounded-lg border border-line bg-surface">
                  {state.links
                    .filter((link) => link.status === "active")
                    .slice(0, 6)
                    .map((link) => (
                      <li key={link.id} className="border-b border-line px-4 py-3.5 last:border-b-0 md:px-5">
                        <Person name={link.label} detail={`Vê: ${describeSharing(link.sharing)}`} />
                      </li>
                    ))}
                </ul>
              </section>
            </>
          ))}
      </div>
    </>
  );
}
