"use client";

import { noticeClasses } from "@/design-system/components/notice";
import { Section } from "@/design-system/components/section";
import { Skeleton } from "@/design-system/components/skeleton";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { useToast } from "@/design-system/components/toast";
import { DensityToggle } from "@/design-system/density/density-toggle";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

import { useProfile } from "../hooks/use-profile";
import { BackupPanel } from "./backup-panel";
import { MacroSplitDialog } from "./macro-split-dialog";
import { PlanSummary } from "./plan-summary";
import { ProfileDataSummary } from "./profile-data-summary";
import { ProfileForm } from "./profile-form";
import { StaleWeightNotice } from "./stale-weight-notice";

interface Props {
  /**
   * "Conta e sincronização", pronta. Vem de fora porque `features/profile`
   * não importa `features/auth` (AGENTS.md); quem compõe as duas é `app/`.
   */
  readonly account?: React.ReactNode;
  /**
   * Sem conta, a conta vem antes de tudo (Pedro, 30/09/2026): o que mais
   * importa a quem não entrou é saber que os dados ficam só no aparelho.
   * Com conta, ela desce para depois de Aparência.
   */
  readonly accountFirst?: boolean;
}

/**
 * A aba Perfil, reorganizada em 30/09/2026 (roadmap 9.1, protótipo aprovado):
 * um painel privado em grupos com título, na ordem do que mais se usa.
 *
 * Seu plano → Seus dados → Aparência → Conta e sincronização → Dados e
 * privacidade. Sem conta, a conta sobe para o topo. Sem perfil, "Seu plano"
 * não existe e "Seus dados" é o formulário.
 */
export function ProfileScreen({ account, accountFirst = false }: Props) {
  const { state, writeError, hasConflict, save, clear, reload } = useProfile();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  // A conta aparece mesmo com o perfil carregando ou em erro: antes desta
  // reorganização ela ficava fora desta tela, e continuava lá nesses casos.
  const withAccount = (content: React.ReactNode) => (
    <div className="space-y-10">
      {accountFirst && account}
      {content}
      {!accountFirst && account}
    </div>
  );

  if (state.status === "loading") {
    return withAccount(<Skeleton className="h-72 rounded-lg" />);
  }

  if (state.status === "error") {
    return withAccount(
      <div role="alert" className={noticeClasses("danger", "block")}>
        <p className="text-ink">Não foi possível carregar seu perfil.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </div>,
    );
  }

  const showForm = editing || state.status === "empty";

  return (
    <div className="space-y-10">
      {accountFirst && account}

      {writeError !== null && (
        <div role="alert" className={noticeClasses()}>
          <p>{writeError}</p>
          {/* The one way out of a conflict: reload discards this tab's
              unsaved edit and shows what is actually stored, rather than
              this screen silently re-submitting the same rejected version
              forever. See `useProfile`'s doc comment on `reload`. */}
          {hasConflict && (
            <Button variant="secondary" size="sm" className="mt-2" onClick={reload}>
              Recarregar dados
            </Button>
          )}
        </div>
      )}

      {!showForm && state.status === "ready" && (
        <Section
          title="Seu plano"
          subtitle="Calculado a partir dos seus dados, logo abaixo."
        >
          <div className="space-y-4">
            {/* Above the targets, because it is the reason to doubt them. */}
            <StaleWeightNotice
              profile={state.profile.nutrition}
              pending={saving}
              onApply={(weightKg) => {
                setSaving(true);
                void save({ ...state.profile.nutrition, weightKg }).then((ok) => {
                  setSaving(false);
                  if (ok) toast("Peso atualizado e metas recalculadas.");
                });
              }}
            />

            <PlanSummary
              result={state.result}
              goal={state.profile.nutrition.goal}
              macroSplit={state.profile.nutrition.macroSplit}
              onEditSplit={() => {
                setSplitOpen(true);
              }}
            />
          </div>

          <MacroSplitDialog
            open={splitOpen}
            onClose={() => {
              setSplitOpen(false);
            }}
            current={state.profile.nutrition.macroSplit}
            onSelect={(macroSplit) => {
              void save({ ...state.profile.nutrition, macroSplit }).then((ok) => {
                if (ok) toast("Distribuição de macros atualizada.");
              });
            }}
          />
        </Section>
      )}

      <Section
        title="Seus dados"
        {...(state.status === "empty"
          ? {
              subtitle:
                "Preencha para ver suas metas de calorias e macros. Montar dieta funciona igual sem isso.",
            }
          : {})}
        {...(!showForm
          ? {
              action: (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  Editar dados
                </Button>
              ),
            }
          : {})}
      >
        {showForm ? (
          <ProfileForm
            key={state.status === "ready" ? state.profile.updatedAt : "empty"}
            initial={state.status === "ready" ? state.profile.nutrition : null}
            pending={saving}
            onSubmit={(nutrition) => {
              setSaving(true);
              void save(nutrition).then((ok) => {
                setSaving(false);
                if (!ok) return;
                setEditing(false);
                toast("Metas recalculadas.");
              });
            }}
          />
        ) : (
          state.status === "ready" && <ProfileDataSummary profile={state.profile.nutrition} />
        )}
      </Section>

      {/* Independent of the nutrition profile — a display preference applies
          whether or not the person has ever filled out a goal. */}
      <Section title="Aparência">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="mb-1.5 text-xs text-ink-subtle">Tema</p>
            <ThemeToggle />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-ink-subtle">Tamanho dos botões</p>
            <DensityToggle />
          </div>
        </div>
      </Section>

      {!accountFirst && account}

      {/* Aberto e por último (9.1). Era um `<details>` recolhido, "Dados e
          segurança", e um auditor já o viu se fechar sozinho no meio de uma
          importação; aberto não tem o que fechar. Fica no fim para não se
          confundir com o que se faz todo dia. "Apagar dados do perfil" veio
          para cá: morava ao lado de "Editar dados", a um toque errado dele. */}
      <Section title="Dados e privacidade">
        <div className="space-y-6">
          <BackupPanel />

          {state.status === "ready" && (
            <div className="space-y-2 border-t border-line pt-4">
              <h3 className="text-xs font-semibold text-ink">Apagar dados do perfil</h3>
              <p className="text-xs text-ink-subtle">
                Remove seus dados e as metas. Dietas, treinos e o diário ficam como estão.
              </p>
              {/* Two taps, and the word says what happens. "Desativar" once
                  promised a switch and delivered a delete, with no
                  confirmation and no undo. */}
              <ConfirmButton
                onConfirm={() => {
                  void clear();
                }}
                label="Apagar dados do perfil"
                confirmLabel="Apagar tudo?"
                className="h-(--control-h) px-4 text-sm"
              >
                Apagar dados do perfil
              </ConfirmButton>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
