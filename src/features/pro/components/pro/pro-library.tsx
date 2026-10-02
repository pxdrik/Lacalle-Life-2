"use client";

import { Library, Plus, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { Button, buttonClasses } from "@/design-system/components/button";
import { Card as CardBox } from "@/design-system/components/card";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Dialog } from "@/design-system/components/dialog";
import { EmptyState } from "@/design-system/components/empty-state";
import { noticeClasses } from "@/design-system/components/notice";
import { PageHeader } from "@/design-system/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { Tabs, tabPanelId } from "@/design-system/components/tabs";

import { usePatients } from "../../hooks/use-patients";
import { useTemplates, type TemplateKind } from "../../hooks/use-templates";
import { editorHref, routineEditorHref } from "./patient-page";

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export const templateHref = (id: string) => `/pro/biblioteca/${id}` as Route;
export const routineTemplateHref = (id: string) => `/pro/biblioteca/treino/${id}` as Route;

/** Um modelo como o cartão mostra, de qualquer tipo. */
interface Card {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly updatedAt: string;
}

const KINDS: Readonly<
  Record<
    TemplateKind,
    {
      readonly label: string;
      readonly emptyTitle: string;
      readonly empty: string;
      readonly newName: string;
      readonly href: (id: string) => Route;
      readonly what: string;
      readonly open: (linkId: string, id: string) => Route;
    }
  >
> = {
  plans: {
    label: "Planos alimentares",
    emptyTitle: "Nenhum modelo de plano ainda.",
    empty: "Monte um plano que você usa com frequência e comece os próximos pacientes por ele.",
    newName: "Modelo novo",
    href: templateHref,
    what: "um plano novo para o paciente, em rascunho, com as refeições do modelo",
    open: editorHref,
  },
  routines: {
    label: "Treinos",
    emptyTitle: "Nenhum modelo de treino ainda.",
    empty: "Monte um treino que você passa com frequência e comece os próximos pacientes por ele. Os dias você escolhe em cada paciente.",
    newName: "Treino novo",
    href: routineTemplateHref,
    what: "um treino novo para o paciente, em rascunho, com os exercícios do modelo e sem dias",
    open: routineEditorHref,
  },
};

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/**
 * A Biblioteca (protótipo v3, 28/09/2026; Etapa 5d; modelos de treino no
 * protótipo de 02/10/2026): os modelos do treinador, de plano alimentar e de
 * treino. Cada modelo abre no editor do app, como o que ele prescreve. "Usar
 * em paciente" cria uma cópia em rascunho: mudar o modelo depois não mexe em
 * nada publicado, e o paciente só vê depois de publicar. Sem compartilhar
 * modelo com ninguém.
 */
export function ProLibrary() {
  const library = useTemplates();
  const router = useRouter();
  const [kind, setKind] = useState<TemplateKind>("plans");
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [applying, setApplying] = useState<{ readonly kind: TemplateKind; readonly card: Card } | null>(null);

  const create = () => {
    setCreating(true);
    setFailed(null);
    library
      .create(kind, KINDS[kind].newName)
      .then((id) => {
        router.push(KINDS[kind].href(id));
      })
      .catch(() => {
        setCreating(false);
        setFailed("Não foi possível criar o modelo. Confira a conexão e tente de novo.");
      });
  };

  const cards: Readonly<Record<TemplateKind, readonly Card[]>> | null =
    library.state.status === "ready"
      ? {
          plans: library.state.plans.map((template) => ({
            id: template.id,
            name: template.name,
            description: `${plural(template.mealCount, "refeição", "refeições")} · ${formatDecimal(template.kcal, 0)} kcal`,
            updatedAt: template.updatedAt,
          })),
          routines: library.state.routines.map((template) => ({
            id: template.id,
            name: template.name,
            description: `${plural(template.exerciseCount, "exercício", "exercícios")} · ${plural(template.setCount, "série", "séries")}`,
            updatedAt: template.updatedAt,
          })),
        }
      : null;
  const list = cards?.[kind] ?? [];

  return (
    <>
      <PageHeader
        icon={Library}
        title="Biblioteca"
        subtitle="Seus modelos. Usar um modelo cria uma cópia; editar o modelo não muda o que já foi publicado."
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

      <Tabs
        idPrefix="biblioteca"
        items={(["plans", "routines"] as const).map((id) => ({
          id,
          label: cards === null ? KINDS[id].label : `${KINDS[id].label} · ${String(cards[id].length)}`,
        }))}
        value={kind}
        onChange={(id) => {
          setKind(id === "routines" ? "routines" : "plans");
        }}
        className="mt-6 overflow-x-auto"
      />

      <div role="tabpanel" id={tabPanelId("biblioteca", kind)} aria-labelledby={`biblioteca-tab-${kind}`} className="mt-6 space-y-4">
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
        {cards !== null &&
          (list.length === 0 ? (
            <EmptyState
              icon={Library}
              title={KINDS[kind].emptyTitle}
              caption={KINDS[kind].empty}
              action={{ label: "Novo modelo", onClick: create, icon: Plus }}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((card) => (
                <TemplateCard
                  key={card.id}
                  card={card}
                  href={KINDS[kind].href(card.id)}
                  onApply={() => {
                    setApplying({ kind, card });
                  }}
                  onRemove={() => {
                    setFailed(null);
                    library.remove(kind, card.id).catch(() => {
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
          card={applying.card}
          what={KINDS[applying.kind].what}
          apply={(linkId) => library.applyToPatient(applying.kind, applying.card.id, linkId)}
          open={KINDS[applying.kind].open}
          onClose={() => {
            setApplying(null);
          }}
        />
      )}
    </>
  );
}

function TemplateCard({
  card,
  href,
  onApply,
  onRemove,
}: {
  readonly card: Card;
  readonly href: Route;
  readonly onApply: () => void;
  readonly onRemove: () => void;
}) {
  return (
    <CardBox as="li" padded={false} className="flex flex-col transition-colors duration-150 ease-out hover:border-line-strong">
      <Link href={href} className="block flex-1 p-4">
        <h3 className="font-semibold break-words text-ink">{card.name}</h3>
        <p className="mt-1 text-sm text-ink-subtle">{card.description}</p>
        <p className="mt-1 text-xs text-ink-subtle">Atualizado em {DATE.format(new Date(card.updatedAt))}</p>
      </Link>
      {/* Data no corpo: com ela no rodapé, "Usar em paciente" descia sozinho
          para uma segunda linha mesmo na grade de três colunas. Apagar é a
          lixeira, como em Treinos: com a palavra, as fontes do Linux (CI)
          quebravam o rodapé em 320px Confortável. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 py-1">
        <ConfirmButton label={`Apagar ${card.name}`} confirmLabel="Apagar?" onConfirm={onRemove} className="min-h-11 min-w-11">
          <Trash2 aria-hidden className="size-4" />
        </ConfirmButton>
        <Button variant="ghost" size="sm" onClick={onApply}>
          Usar em paciente
        </Button>
      </div>
    </CardBox>
  );
}

/**
 * Para quem é a cópia: só vínculo ativo, porque o banco recusa plano e treino
 * em vínculo encerrado. Escolher cria a cópia e abre o editor dela.
 */
function ApplyDialog({
  card,
  what,
  apply,
  open,
  onClose,
}: {
  readonly card: Card;
  readonly what: string;
  readonly apply: (linkId: string) => Promise<string>;
  readonly open: (linkId: string, id: string) => Route;
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
    apply(linkId)
      .then((id) => {
        router.push(open(linkId, id));
      })
      .catch(() => {
        setPending(null);
        setFailed(true);
      });
  };

  return (
    <Dialog open title={`Usar ${card.name}`} onClose={onClose}>
      <p className="text-sm text-ink-muted">Cria {what}. Ele só vê depois que você publicar.</p>
      {failed && (
        <p role="alert" className={`mt-3 ${noticeClasses("danger", "block")}`}>
          Não foi possível criar a cópia. Confira a conexão e tente de novo.
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
