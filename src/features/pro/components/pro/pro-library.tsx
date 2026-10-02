"use client";

import { Library, Plus, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { Button, buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Dialog } from "@/design-system/components/dialog";
import { EmptyState } from "@/design-system/components/empty-state";
import { noticeClasses } from "@/design-system/components/notice";
import { PageHeader } from "@/design-system/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";

import type { PlanTemplate } from "../../data/template-repository";
import { usePatients } from "../../hooks/use-patients";
import { useTemplates } from "../../hooks/use-templates";
import { editorHref } from "./patient-page";

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export const templateHref = (id: string) => `/pro/biblioteca/${id}` as Route;

/**
 * A Biblioteca (protótipo v3, 28/09/2026; Etapa 5d): os modelos de plano
 * alimentar da profissional. O modelo abre no editor de dieta do app, como o
 * plano. "Usar em paciente" cria um plano novo, em rascunho, com uma cópia
 * das refeições: mudar o modelo depois não mexe em plano nenhum, e o
 * paciente só vê depois de publicar. Sem compartilhar modelo com ninguém.
 */
export function ProLibrary() {
  const library = useTemplates();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [applying, setApplying] = useState<PlanTemplate | null>(null);

  const create = () => {
    setCreating(true);
    setFailed(null);
    library
      .create("Modelo novo")
      .then((id) => {
        router.push(templateHref(id));
      })
      .catch(() => {
        setCreating(false);
        setFailed("Não foi possível criar o modelo. Confira a conexão e tente de novo.");
      });
  };

  return (
    <>
      <PageHeader
        icon={Library}
        title="Biblioteca"
        subtitle="Seus modelos. Usar um modelo cria uma cópia; editar o modelo não muda planos publicados."
        // Em 320px Confortável, "Biblioteca" ficava 1px maior que a coluna com o gap de 16.
        className="gap-2 sm:gap-4"
      >
        {/* Só o ícone no celular, como "Criar" em Treinos: com o texto, o
            botão espremia o título até "Biblioteca" passar por baixo dele
            (visto na captura em 390px). */}
        <Button pending={creating} onClick={create} aria-label="Novo modelo" className="shrink-0">
          <Plus aria-hidden className="size-4" />
          <span className="hidden sm:inline">Novo modelo</span>
        </Button>
      </PageHeader>

      <div className="mt-8 space-y-4">
        {failed !== null && (
          <p role="alert" className={noticeClasses("danger", "block")}>
            {failed}
          </p>
        )}
        {library.state.status === "loading" && <Skeleton className="h-40" />}
        {library.state.status === "error" && (
          <div role="alert" className={noticeClasses("danger", "block")}>
            <p className="text-ink">Não foi possível carregar a Biblioteca.</p>
            <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e recarregue a página.</p>
          </div>
        )}
        {library.state.status === "ready" &&
          (library.state.templates.length === 0 ? (
            <EmptyState
              icon={Library}
              title="Nenhum modelo ainda."
              caption="Monte um plano que você usa com frequência e comece os próximos pacientes por ele."
              action={{ label: "Novo modelo", onClick: create, icon: Plus }}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {library.state.templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onApply={() => {
                    setApplying(template);
                  }}
                  onRemove={() => {
                    setFailed(null);
                    library.remove(template.id).catch(() => {
                      setFailed("Não foi possível apagar o modelo. Confira a conexão e tente de novo.");
                    });
                  }}
                />
              ))}
            </ul>
          ))}
      </div>

      {applying !== null && (
        <ApplyDialog
          template={applying}
          apply={library.applyToPatient}
          onClose={() => {
            setApplying(null);
          }}
        />
      )}
    </>
  );
}

function describeTemplate(template: PlanTemplate): string {
  const meals = template.mealCount;
  return `${String(meals)} ${meals === 1 ? "refeição" : "refeições"} · ${formatDecimal(template.kcal, 0)} kcal`;
}

function TemplateCard({
  template,
  onApply,
  onRemove,
}: {
  readonly template: PlanTemplate;
  readonly onApply: () => void;
  readonly onRemove: () => void;
}) {
  return (
    <Card as="li" padded={false} className="flex flex-col transition-colors duration-150 ease-out hover:border-line-strong">
      <Link href={templateHref(template.id)} className="block flex-1 p-4">
        <h3 className="font-semibold break-words text-ink">{template.name}</h3>
        <p className="mt-1 text-sm text-ink-subtle">{describeTemplate(template)}</p>
        <p className="mt-1 text-xs text-ink-subtle">Atualizado em {DATE.format(new Date(template.updatedAt))}</p>
      </Link>
      {/* Data no corpo: com ela no rodapé, "Usar em paciente" descia sozinho
          para uma segunda linha mesmo na grade de três colunas. Apagar é a
          lixeira, como em Treinos: com a palavra, as fontes do Linux (CI)
          quebravam o rodapé em 320px Confortável. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 py-1">
        <ConfirmButton
          label={`Apagar ${template.name}`}
          confirmLabel="Apagar?"
          onConfirm={onRemove}
          className="min-h-11 min-w-11"
        >
          <Trash2 aria-hidden className="size-4" />
        </ConfirmButton>
        <Button variant="ghost" size="sm" onClick={onApply}>
          Usar em paciente
        </Button>
      </div>
    </Card>
  );
}

/**
 * Para quem é o plano novo: só vínculo ativo, porque o banco recusa plano em
 * vínculo encerrado. Escolher cria o plano e abre o editor dele.
 */
function ApplyDialog({
  template,
  apply,
  onClose,
}: {
  readonly template: PlanTemplate;
  readonly apply: (template: PlanTemplate, linkId: string) => Promise<string>;
  readonly onClose: () => void;
}) {
  const { state } = usePatients();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const active = state.status === "ready" ? state.links.filter((link) => link.status === "active") : [];

  const choose = (linkId: string) => {
    setPending(linkId);
    setFailed(false);
    apply(template, linkId)
      .then((planId) => {
        router.push(editorHref(linkId, planId));
      })
      .catch(() => {
        setPending(null);
        setFailed(true);
      });
  };

  return (
    <Dialog open title={`Usar ${template.name}`} onClose={onClose}>
      <p className="text-sm text-ink-muted">
        Cria um plano novo para o paciente, em rascunho, com as refeições do modelo. Ele só vê depois que você publicar.
      </p>
      {failed && (
        <p role="alert" className={`mt-3 ${noticeClasses("danger", "block")}`}>
          Não foi possível criar o plano. Confira a conexão e tente de novo.
        </p>
      )}
      {state.status === "loading" && <Skeleton className="mt-4 h-24" />}
      {state.status === "error" && (
        <p role="alert" className={`mt-3 ${noticeClasses("danger", "block")}`}>
          Não foi possível carregar os pacientes.
        </p>
      )}
      {state.status === "ready" &&
        (active.length === 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink">Nenhum paciente com vínculo ativo.</p>
            <Link href="/pro/pacientes" className={buttonClasses("secondary", "sm")}>
              Ir para Pacientes
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {active.map((link) => (
              <li key={link.id}>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => {
                    choose(link.id);
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm text-ink transition-colors duration-150 ease-out hover:text-accent-text disabled:opacity-50"
                >
                  <span className="min-w-0 break-words">{link.label}</span>
                  <span aria-hidden className="shrink-0 text-ink-subtle">
                    {pending === link.id ? "Criando…" : "Escolher"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </Dialog>
  );
}
