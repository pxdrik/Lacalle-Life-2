"use client";

import { ChevronDown } from "lucide-react";
import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { useToast } from "@/design-system/components/toast";
import { DensityToggle } from "@/design-system/density/density-toggle";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

import { useProfile } from "../hooks/use-profile";
import { BackupPanel } from "./backup-panel";
import { PlanSummary } from "./plan-summary";
import { ProfileForm } from "./profile-form";
import { StaleWeightNotice } from "./stale-weight-notice";

export function ProfileScreen() {
  const { state, writeError, save, clear } = useProfile();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (state.status === "loading") {
    return <Skeleton className="h-72 rounded-lg" />;
  }

  if (state.status === "error") {
    return (
      <div role="alert" className={noticeClasses("danger", "block")}>
        <p className="text-ink">Não foi possível carregar seu perfil.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </div>
    );
  }

  const showForm = editing || state.status === "empty";

  return (
    <div className="space-y-6">
      {writeError !== null && (
        <p role="alert" className={noticeClasses()}>
          {writeError}
        </p>
      )}

      {/* Independent of the nutrition profile below — a display preference
          applies whether or not the person has ever filled out a goal. */}
      <div>
        <h2 className="text-sm font-medium text-ink">Aparência</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div>
            <p className="mb-1.5 text-xs text-ink-subtle">Tema</p>
            <ThemeToggle />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-ink-subtle">Tamanho dos botões</p>
            <DensityToggle />
          </div>
        </div>
      </div>

      {showForm ? (
        <ProfileForm
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
        <>
          {/* Above the targets, because it is the reason to doubt them. */}
          {state.status === "ready" && (
            <StaleWeightNotice
              profile={state.profile.nutrition}
              pending={saving}
              onApply={(weightKg) => {
                setSaving(true);
                void save({ ...state.profile.nutrition, weightKg }).then(
                  (ok) => {
                    setSaving(false);
                    if (ok) toast("Peso atualizado e metas recalculadas.");
                  },
                );
              }}
            />
          )}

          <PlanSummary
            result={state.result}
            goal={state.profile.nutrition.goal}
          />

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(true);
              }}
            >
              Editar dados
            </Button>
            {/* Two taps, and the word says what happens.
                "Desativar" promised a switch and delivered a delete: one
                click erased sex, age, height, weight, activity and goal with
                no confirmation and no undo, from a ghost button sitting
                beside "Editar dados". Every other destructive action in the
                app already went through `ConfirmButton`; the one that
                destroyed the most did not. */}
            <ConfirmButton
              onConfirm={() => {
                void clear();
              }}
              label="Apagar dados do perfil"
              confirmLabel="Apagar tudo?"
              className="h-(--control-h) px-4 text-sm"
            >
              Apagar dados
            </ConfirmButton>
          </div>

          <p className="text-xs text-ink-subtle">
            Apagar remove seus dados e as metas junto. Montar dieta continua
            funcionando igual.
          </p>
        </>
      )}

      {/* Independent of the nutrition form and of `state`: a backup exists
          whether or not a profile does, and covers every domain, not just
          this one. Moved to a secondary, collapsed area (H.1): it used to
          be the first card on the screen, ahead of the profile fields
          someone actually came here to fill in. Collapsed, not hidden — the
          `<details>` element gets this for free, with no JS state and no
          dependency, and stays reachable to a screen reader and to
          find-in-page either way. */}
      <details className="group rounded-lg border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          Dados e segurança
          <ChevronDown
            aria-hidden
            className="size-4 text-ink-subtle transition-transform duration-150 ease-out group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-line p-4">
          <BackupPanel />
        </div>
      </details>
    </div>
  );
}
